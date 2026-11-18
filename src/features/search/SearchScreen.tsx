"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BackIcon, ButtonLink, Card, cn, SearchIcon } from "@/components/ui";
import { navigateHref, walkLabel } from "@/features/route";
import { publicEnv } from "@/lib/config/env";
import type { Place } from "@/types";
import { CATEGORY_TONE, CategoryIcon } from "./CategoryIcon";
import { SEARCH_CATEGORIES, type SearchCategory } from "./categories";
import { geocode } from "./geocode";
import { searchNearby } from "./nearby";
import { useOrigin, type Origin } from "./useOrigin";

/** 打ち終わってからこの時間で検索する */
const TYPING_DELAY_MS = 600;

type SearchMode = { kind: "idle" } | { kind: "text"; query: string } | { kind: "category"; category: SearchCategory };

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; places: Place[] }
  | { status: "error" }
  /** 文字検索のキー(NEXT_PUBLIC_MAPTILER_KEY)が未設定 */
  | { status: "no_key" };

async function runSearch(mode: SearchMode, origin: Origin, signal: AbortSignal): Promise<ResultState> {
  const key = publicEnv.maptilerKey;
  if (mode.kind === "idle") return { status: "idle" };

  if (mode.kind === "category") {
    try {
      return { status: "done", places: await searchNearby(mode.category, origin.position, { signal }) };
    } catch (error) {
      if (signal.aborted) throw error;
      // OpenStreetMap 側が混んでいるときは、文字検索で代わりにさがす
      if (!key) return { status: "error" };
      return { status: "done", places: await geocode(mode.category.label, { key, proximity: origin.position, signal }) };
    }
  }

  if (!key) return { status: "no_key" };
  return { status: "done", places: await geocode(mode.query, { key, proximity: origin.position, signal }) };
}

/** 検索画面: 文字でさがす+「よく使う」ボタン。結果の「行く」1回で道案内がはじまる */
export function SearchScreen() {
  const origin = useOrigin();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<SearchMode>({ kind: "idle" });
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 検索する
  useEffect(() => {
    if (!origin) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 検索を始めたことを画面に出す
    setResult(mode.kind === "idle" ? { status: "idle" } : { status: "loading" });
    runSearch(mode, origin, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setResult(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ status: "error" });
      });
    return () => controller.abort();
  }, [mode, origin]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const submitText = (value: string) => {
    clearTimeout(timer.current);
    const q = value.trim();
    setMode((m) => {
      if (!q) return { kind: "idle" };
      if (m.kind === "text" && m.query === q) return m;
      if (m.kind === "category" && m.category.label === q) return m;
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
        <label className="flex h-[60px] min-w-0 flex-1 items-center gap-2.5 rounded-full border-[2.5px] border-coral bg-card px-[18px]">
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
            className="w-full min-w-0 flex-1 border-none bg-transparent text-xl font-bold text-ink outline-none placeholder:font-medium placeholder:text-ink-soft/70"
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
                  "flex h-[76px] flex-col items-center justify-center gap-1 whitespace-nowrap rounded-[22px] text-base font-bold text-ink transition-transform active:scale-95",
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

      <Results heading={heading} result={result} origin={origin} />
    </div>
  );
}

function Results({ heading, result, origin }: { heading: string | null; result: ResultState; origin: Origin | null }) {
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
          いまいる場所がわからないため、最後に見ていた地図のあたりでさがしています。
        </p>
      ) : null}
      <ResultBody result={result} origin={origin} />
      {result.status === "done" && result.places.length > 0 ? (
        <p className="m-0 text-center text-[15px] leading-relaxed text-ink-soft">
          右の「行く」を押すだけで道案内がはじまります
        </p>
      ) : null}
    </section>
  );
}

function ResultBody({ result, origin }: { result: ResultState; origin: Origin | null }) {
  switch (result.status) {
    case "loading":
      return (
        <Card className="p-6 text-center text-lg font-bold text-ink-soft" role="status">
          さがしています…
        </Card>
      );
    case "no_key":
      return (
        <Card className="p-6 text-lg leading-relaxed text-ink-soft" role="alert">
          いまは文字での検索が使えません。上の「よく使う」ボタンからさがしてください。
        </Card>
      );
    case "error":
      return (
        <Card className="p-6 text-lg leading-relaxed text-ink-soft" role="alert">
          うまくさがせませんでした。電波のよい場所で、もう一度ためしてください。
        </Card>
      );
    case "done":
      if (result.places.length === 0) {
        return (
          <Card className="p-6 text-lg leading-relaxed text-ink-soft" role="status">
            見つかりませんでした。別の言葉でためしてください。
          </Card>
        );
      }
      return (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
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
    <Card className="flex items-center gap-3 py-4 pr-4 pl-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="m-0 text-[19px] leading-snug font-bold break-words">{place.name}</p>
        {near ? <p className="m-0 text-[15px] text-ink-soft">{near}</p> : null}
        {place.address ? <p className="m-0 truncate text-[15px] text-ink-soft">{place.address}</p> : null}
      </div>
      <ButtonLink href={navigateHref(place)} aria-label={`${place.name}へ行く`} className="flex-none px-6">
        行く
      </ButtonLink>
    </Card>
  );
}
