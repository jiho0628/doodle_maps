"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink, Card, HeartIcon, PlusIcon, ScreenHeader, WarningIcon } from "@/components/ui";
import type { Favorite, LngLat } from "@/types";
import { FavoriteBadge } from "./FavoriteIcon";
import { FavoriteForm } from "./FavoriteForm";
import { mapHrefForFavorite } from "./focus";
import { Sheet } from "./Sheet";
import { useStartRoute } from "./startRoute";
import { useFavorites } from "./useFavorites";
import { LOCATE_ERROR_MESSAGES, useLocateOnce } from "./useLocateOnce";

type Panel =
  | { kind: "none" }
  | { kind: "add"; position: LngLat }
  | { kind: "menu"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "confirm-delete"; id: string };

const SAVE_FAILED = "保存できませんでした。もう一度ためしてください。";

/** お気に入り画面(A案) */
export function FavoritesScreen() {
  const router = useRouter();
  const { favorites, add, update, remove, getById } = useFavorites();
  const startRoute = useStartRoute();
  const { state: locateState, locate, reset: resetLocate } = useLocateOnce();
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const close = () => setPanel({ kind: "none" });
  const selected = "id" in panel ? getById(panel.id) : undefined;

  const onSaveHere = async () => {
    setNotice(null);
    const position = await locate();
    if (position) setPanel({ kind: "add", position });
  };

  return (
    <div className="h-full overflow-y-auto px-5 pb-6" style={{ paddingTop: "max(28px, env(safe-area-inset-top))" }}>
      {/* シートを開いている間は後ろの一覧を操作・読み上げの対象から外す */}
      <div className="flex flex-col gap-4" inert={panel.kind !== "none"}>
        <ScreenHeader
          title="お気に入り"
          description={favorites.length > 0 ? "名前を押すと、変えたり消したりできます。" : undefined}
        />

        {notice ? (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={
              notice.tone === "error"
                ? "m-0 rounded-2xl bg-primary-soft px-4 py-3 text-lg font-bold text-primary-strong"
                : "m-0 rounded-2xl bg-leaf-soft px-4 py-3 text-lg font-bold text-leaf"
            }
          >
            {notice.text}
          </p>
        ) : null}

        {favorites.length === 0 ? (
          <EmptyCard />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0" aria-label="お気に入りの一覧">
            {favorites.map((f) => (
              <li key={f.id}>
                <FavoriteRow favorite={f} onOpen={() => setPanel({ kind: "menu", id: f.id })} onGo={() => startRoute(f)} />
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="dashed"
          size="lg"
          block
          icon={<PlusIcon size={24} />}
          onClick={onSaveHere}
          disabled={locateState.status === "locating"}
          aria-busy={locateState.status === "locating"}
        >
          {locateState.status === "locating" ? "いまいる場所をさがしています…" : "いまいる場所を保存"}
        </Button>

        {locateState.status === "error" ? (
          <Card role="alert" className="flex items-start gap-3 text-lg leading-relaxed">
            <span className="mt-0.5 flex-none text-primary">
              <WarningIcon size={28} />
            </span>
            <span className="flex-1">{LOCATE_ERROR_MESSAGES[locateState.error]}</span>
          </Card>
        ) : null}
      </div>

      {panel.kind === "add" ? (
        <Sheet title="この場所を保存します" onClose={close}>
          <FavoriteForm
            submitLabel="保存する"
            onCancel={close}
            onSubmit={({ name, icon }) => {
              const result = add({ name: name || "保存した場所", position: panel.position, icon });
              close();
              resetLocate();
              if (!result.ok) setNotice({ tone: "error", text: SAVE_FAILED });
              else if (!result.added) setNotice({ tone: "info", text: `この場所は「${result.favorite.name}」として保存ずみです。` });
              else setNotice({ tone: "info", text: `「${result.favorite.name}」を保存しました。` });
            }}
          />
        </Sheet>
      ) : null}

      {panel.kind === "menu" && selected ? (
        <Sheet title={selected.name} onClose={close}>
          {selected.address ? <p className="-mt-3 m-0 text-base text-ink-soft">{selected.address}</p> : null}
          <div className="flex flex-col gap-3">
            <Button size="lg" block onClick={() => startRoute(selected)}>
              ここへ行く
            </Button>
            <Button variant="soft" block onClick={() => router.push(mapHrefForFavorite(selected.id))}>
              地図で見る
            </Button>
            <Button variant="soft" block onClick={() => setPanel({ kind: "edit", id: selected.id })}>
              名前を変える
            </Button>
            <Button variant="soft" block onClick={() => setPanel({ kind: "confirm-delete", id: selected.id })}>
              消す
            </Button>
            <Button variant="white" block onClick={close}>
              とじる
            </Button>
          </div>
        </Sheet>
      ) : null}

      {panel.kind === "edit" && selected ? (
        <Sheet title="名前を変える" onClose={close}>
          <FavoriteForm
            initialName={selected.name}
            initialIcon={selected.icon}
            submitLabel="変える"
            onCancel={close}
            onSubmit={({ name, icon }) => {
              const ok = update(selected.id, { name, icon });
              close();
              setNotice(ok ? { tone: "info", text: "名前を変えました。" } : { tone: "error", text: SAVE_FAILED });
            }}
          />
        </Sheet>
      ) : null}

      {panel.kind === "confirm-delete" && selected ? (
        <Sheet title={`「${selected.name}」を消しますか？`} onClose={close} role="alertdialog">
          <p className="-mt-2 m-0 text-lg leading-relaxed text-ink-soft">消すと、もとにもどせません。</p>
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              block
              onClick={() => {
                const name = selected.name;
                const ok = remove(selected.id);
                close();
                setNotice(ok ? { tone: "info", text: `「${name}」を消しました。` } : { tone: "error", text: SAVE_FAILED });
              }}
            >
              消す
            </Button>
            <Button variant="white" size="lg" block data-autofocus onClick={close}>
              やめる
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function FavoriteRow({ favorite, onOpen, onGo }: { favorite: Favorite; onOpen: () => void; onGo: () => void }) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${favorite.name}(名前を変える・消す)`}
        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3.5 rounded-2xl text-left"
      >
        <FavoriteBadge icon={favorite.icon} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="break-words text-xl font-bold leading-snug">{favorite.name}</span>
          {favorite.address ? <span className="truncate text-base text-ink-soft">{favorite.address}</span> : null}
        </span>
      </button>
      <Button onClick={onGo} aria-label={`${favorite.name}へ行く`} className="flex-none px-5">
        行く
      </Button>
    </Card>
  );
}

function EmptyCard() {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-[20px] bg-primary-soft text-primary-strong">
        <HeartIcon size={34} />
      </span>
      <p className="m-0 text-xl font-bold">まだ何も入っていません</p>
      <p className="m-0 text-base leading-relaxed text-ink-soft">
        よく行く場所を登録しておくと、
        <br />
        ここからすぐに道案内できます。
      </p>
      <ButtonLink href="/" variant="soft" block>
        地図を見る
      </ButtonLink>
    </Card>
  );
}
