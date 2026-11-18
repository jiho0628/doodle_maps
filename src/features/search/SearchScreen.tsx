"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BackIcon, Button, ButtonLink, Card, cn, SearchIcon } from "@/components/ui";
import { FavoriteToggleButton } from "@/features/favorites";
import { navigateHref, walkLabel } from "@/features/route";
import { publicEnv } from "@/lib/config/env";
import type { LngLat, Place } from "@/types";
import { CATEGORY_TONE, CategoryIcon } from "./CategoryIcon";
import { matchCategory, SEARCH_CATEGORIES, type SearchCategory } from "./categories";
import { searchPlacesByText } from "./geocode";
import { searchHere } from "./hereClient";
import { searchNearbyWithMapTiler } from "./mapTilerNearby";
import { resetNearbyFailure, searchNearby } from "./nearby";
import { useOrigin, type Origin } from "./useOrigin";

/** 打ち終わってからこの時間で検索する */
const TYPING_DELAY_MS = 600;

type SearchMode = { kind: "idle" } | { kind: "text"; query: string } | { kind: "category"; category: SearchCategory };

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  /** more: まだ別のさがし方の結果を待っている(あとから下に足す) */
  | { status: "done"; places: Place[]; more?: boolean; source?: "here" }
  | { status: "error" }
  /** 文字検索のキー(NEXT_PUBLIC_MAPTILER_KEY)が未設定 */
  | { status: "no_key" };

async function runSearch(
  mode: SearchMode,
  origin: Origin | null,
  signal: AbortSignal,
  onPartial: (state: ResultState) => void,
): Promise<ResultState> {
  const key = publicEnv.maptilerKey;
  if (mode.kind === "idle") return { status: "idle" };

  if (!origin) return { status: "loading" };

  // HERE(キーがあるとき)を先に聞く。小さなお店まで載っていて速い。
  // キー未設定・失敗・0件なら、今までの MapTiler / OpenStreetMap でさがす
  const here = await searchHere(
    mode.kind === "category" ? { category: mode.category.id } : { q: mode.query },
    origin.position,
    { signal },
  );
  if (here && here.length > 0) return { status: "done", places: here, source: "here" };

  if (mode.kind === "category") {
    return { status: "done", places: await nearbyProgressive(mode.category, origin.position, key, signal, onPartial) };
  }

  if (!key) return here ? { status: "done", places: [] } : { status: "no_key" };
  return { status: "done", places: await searchPlacesByText(mode.query, { key, proximity: origin?.position, signal }) };
}

/** 同じ店か(名前が同じで、だいたい同じ場所) */
function samePlace(a: Place, b: Place): boolean {
  const norm = (n: string) => n.normalize("NFKC").replace(/[\s・\-ー]/g, "");
  return (
    norm(a.name) === norm(b.name) &&
    Math.abs(a.position.lat - b.position.lat) < 0.0008 &&
    Math.abs(a.position.lng - b.position.lng) < 0.0008
  );
}

/**
 * 近くの店をさがす。MapTiler(チェーン名で検索、速い)と OpenStreetMap(近い順で正確だが遅いことがある)を
 * 同時に始め、先に返ってきた結果をすぐ出す。あとから返ってきた結果は、並びを変えずに下へ足す
 * (押そうとした「行く」の位置がずれないように)。
 */
async function nearbyProgressive(
  category: SearchCategory,
  center: LngLat,
  key: string,
  signal: AbortSignal,
  onPartial: (state: ResultState) => void,
): Promise<Place[]> {
  let shown: Place[] = [];
  let pending = 0;
  let failed = 0;

  const add = (places: Place[]) => {
    const extra = places.filter((p) => !shown.some((s) => samePlace(s, p)));
    if (extra.length > 0) shown = [...shown, ...extra];
  };

  const sources: Promise<Place[]>[] = [searchNearby(category, center, { signal })];
  if (key) sources.push(searchNearbyWithMapTiler(category, center, { key, signal }));
  pending = sources.length;

  await Promise.all(
    sources.map((source) =>
      source.then(
        (places) => {
          pending -= 1;
          add(places);
          if (pending > 0 && shown.length > 0 && !signal.aborted) onPartial({ status: "done", places: shown, more: true });
        },
        () => {
          pending -= 1;
          failed += 1;
        },
      ),
    ),
  );
  // どこかで通信に失敗して1件も出せないときは「見つからない」ではなく通信のエラーにする
  // (OpenStreetMap が失敗し、MapTiler が0件だっただけなのに「ない」と言わないように)
  if (shown.length === 0 && failed > 0) throw new Error("nearby search failed");
  return shown;
}

/** 検索画面: 文字でさがす+「よく使う」ボタン。結果の「行く」1回で道案内がはじまる */
export function SearchScreen() {
  const origin = useOrigin();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<SearchMode>({ kind: "idle" });
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  /** 「もう一度ためす」を押すたびに増やし、同じ条件で検索しなおす */
  const [attempt, setAttempt] = useState(0);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const searchOrigin = mode.kind === "idle" ? null : origin;

  // 検索する(基準の場所が決まるまで待つ。名前での検索も近くのお店を優先するため)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 検索を始めたことを画面に出す
    setResult(mode.kind === "idle" ? { status: "idle" } : { status: "loading" });
    if (mode.kind === "idle" || !searchOrigin) return;
    const controller = new AbortController();
    runSearch(mode, searchOrigin, controller.signal, (partial) => {
      if (!controller.signal.aborted) setResult(partial);
    })
      .then((next) => {
        if (!controller.signal.aborted) setResult(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ status: "error" });
      });
    return () => controller.abort();
  }, [mode, searchOrigin, attempt]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const submitText = (value: string) => {
    clearTimeout(timer.current);
    const q = value.trim();
    setMode((m) => {
      if (!q) return { kind: "idle" };
      if (m.kind === "text" && m.query === q) return m;
      // 「コンビニ」「近くのカフェ」などは、店名の検索ではなく近くの店をさがす
      const category = matchCategory(q);
      if (category) return m.kind === "category" && m.category.id === category.id ? m : { kind: "category", category };
      return { kind: "text", query: q };
    });
  };

  const onChange = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    // 日本語の変換中は検索しない(確定してから)
    if (composing.current) return;
    timer.current = setTimeout(() => submitText(value), TYPING_DELAY_MS);
  };

  const chooseCategory = (category: SearchCategory) => {
    clearTimeout(timer.current);
    setText(category.label);
    setMode({ kind: "category", category });
  };

  const heading =
    mode.kind === "category"
      ? `近くの${mode.category.label}`
      : mode.kind === "text"
        ? `「${mode.query}」の検索結果`
        : null;

  return (
    <div
      className="flex min-h-dvh flex-col gap-[22px] bg-surface px-5"
      style={{
        paddingTop: "max(20px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <form
        role="search"
        className="flex items-center gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          submitText(text);
        }}
      >
        <Link
          href="/"
          aria-label="地図にもどる"
          className="flex size-[60px] flex-none items-center justify-center rounded-full bg-card text-ink shadow-card"
        >
          <BackIcon size={28} />
        </Link>
        <label className="flex h-[60px] min-w-0 flex-1 items-center gap-2.5 rounded-full border-[2.5px] border-coral bg-card px-[18px] focus-within:ring-[3px] focus-within:ring-primary-soft">
          <span className="text-primary">
            <SearchIcon size={24} />
          </span>
          <input
            type="search"
            enterKeyHint="search"
            autoFocus
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(e) => {
              composing.current = false;
              onChange(e.currentTarget.value);
            }}
            placeholder="場所の名前や住所"
            aria-label="場所をさがす"
            // 共通の :focus-visible の四角い枠を消し、外側の丸い枠(focus-within)だけで示す
            style={{ outline: "none" }}
            className="w-full min-w-0 flex-1 border-none bg-transparent text-xl font-bold text-ink [&::-webkit-search-cancel-button]:hidden placeholder:font-medium placeholder:text-ink-soft/70"
          />
        </label>
      </form>

      <section className="flex flex-col gap-2.5" aria-labelledby="search-quick">
        <h2 id="search-quick" className="m-0 text-base font-bold text-ink-soft">
          よく使う
        </h2>
        <div className="grid grid-cols-4 gap-2.5">
          {SEARCH_CATEGORIES.map((c) => {
            const tone = CATEGORY_TONE[c.id];
            const selected = mode.kind === "category" && mode.category.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseCategory(c)}
                className={cn(
                  "flex h-[76px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-[22px] text-base font-bold text-ink transition-[transform,box-shadow] duration-150 active:scale-95",
                  tone.bg,
                  selected && "ring-[3px] ring-coral",
                )}
              >
                <span className={tone.fg}>
                  <CategoryIcon id={c.id} size={26} />
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      <Results heading={heading} result={result} origin={origin} onRetry={() => {
          resetNearbyFailure();
          setAttempt((n) => n + 1);
        }} />
    </div>
  );
}

function Results({
  heading,
  result,
  origin,
  onRetry,
}: {
  heading: string | null;
  result: ResultState;
  origin: Origin | null;
  onRetry: () => void;
}) {
  if (result.status === "idle" || !heading) {
    return (
      <p className="m-0 text-center text-base leading-relaxed text-ink-soft">
        行きたい場所の名前を入れるか、
        <br />
        上のボタンを押してください。
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="search-results" aria-busy={result.status === "loading"}>
      <h2 id="search-results" className="m-0 text-base font-bold text-ink-soft">
        {heading}
      </h2>
      {origin && origin.source !== "gps" ? (
        <p className="m-0 text-[15px] leading-relaxed text-ink-soft">
          {origin.source === "map"
            ? "いまいる場所がわからないため、最後に見ていた地図のあたりでさがしています。"
            : "いまいる場所がわからないため、東京駅のあたりでさがしています。位置情報を許可すると近くをさがせます。"}
        </p>
      ) : null}
      <ResultBody result={result} origin={origin} onRetry={onRetry} />
      {result.status === "done" && result.more ? (
        <p className="m-0 text-center text-[15px] text-ink-soft" role="status">
          ほかにもさがしています…
        </p>
      ) : null}
      {result.status === "done" && result.source === "here" && result.places.length > 0 ? (
        // HERE の規約: 他社の地図と使うときは出所を示す
        <p className="m-0 text-right text-[13px] text-ink-soft">場所の情報 © HERE</p>
      ) : null}
      {result.status === "done" && result.places.length > 0 ? (
        <p className="m-0 text-center text-[15px] leading-relaxed text-ink-soft">
          右の「行く」を押すだけで道案内がはじまります
        </p>
      ) : null}
    </section>
  );
}

function ResultBody({ result, origin, onRetry }: { result: ResultState; origin: Origin | null; onRetry: () => void }) {
  switch (result.status) {
    case "loading":
      return (
        <Card className="animate-fade-in p-6 text-center text-lg font-bold text-ink-soft" role="status">
          {origin ? "さがしています…" : "いまいる場所を調べています…"}
        </Card>
      );
    case "no_key":
      return (
        <Card className="animate-rise-in p-6 text-lg leading-relaxed text-ink-soft" role="alert">
          いまは文字での検索が使えません。上の「よく使う」ボタンからさがしてください。
        </Card>
      );
    case "error":
      return (
        <Card className="flex animate-rise-in flex-col gap-4 p-6">
          <p className="m-0 text-lg leading-relaxed text-ink-soft" role="alert">
            通信がうまくいかなかったため、さがせませんでした。少し待ってから、もう一度ためしてください。
          </p>
          <Button onClick={onRetry}>もう一度ためす</Button>
        </Card>
      );
    case "done":
      if (result.places.length === 0) {
        return (
          <Card className="animate-rise-in p-6 text-lg leading-relaxed text-ink-soft" role="status">
            見つかりませんでした。別の言葉でためしてください。
          </Card>
        );
      }
      return (
        <ul className="m-0 flex animate-rise-in list-none flex-col gap-3 p-0">
          {result.places.map((place) => (
            <li key={place.id}>
              <ResultCard place={place} origin={origin} />
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

function ResultCard({ place, origin }: { place: Place; origin: Origin | null }) {
  const near = origin?.source === "gps" ? walkLabel(origin.position, place.position) : null;
  return (
    <Card className="flex items-center gap-2.5 py-4 pr-3.5 pl-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="m-0 text-[19px] leading-snug font-bold break-words">{place.name}</p>
        {near ? <p className="m-0 text-[15px] text-ink-soft">{near}</p> : null}
        {place.address ? <p className="m-0 truncate text-[15px] text-ink-soft">{place.address}</p> : null}
      </div>
      <FavoriteToggleButton place={place} className="shadow-none ring-2 ring-line" />
      <ButtonLink href={navigateHref(place)} aria-label={`${place.name}へ行く`} className="flex-none px-6">
        行く
      </ButtonLink>
    </Card>
  );
}
