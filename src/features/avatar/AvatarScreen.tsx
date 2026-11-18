"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { BackIcon, Button, IconButton, LockIcon, WarningIcon, cn } from "@/components/ui";
import type { AvatarChoice } from "@/types/avatar";
import { AvatarFigure } from "./AvatarFigure";
import { ANIMAL_AVATARS, avatarLabel, isSameAvatar } from "./avatars";
import { photoFileToDataUrl } from "./photo";
import { useAvatar } from "./useAvatar";

const MSG_DECODE_FAILED = "この写真は読みこめませんでした。べつの写真でためしてください。";
const MSG_SAVE_FAILED =
  "スマホの保存場所がいっぱいで、写真を保存できませんでした。どうぶつをえらぶか、べつの写真でためしてください。";

/** アバター選び画面「地図にうつる「わたし」」 */
export function AvatarScreen() {
  const router = useRouter();
  const [saved, save] = useAvatar();
  // まだ「この子にする」を押していない選択。null の間は保存済みのものを表示
  const [draft, setDraft] = useState<AvatarChoice | null>(null);
  // 今回えらんだ写真(なければ保存済みの写真を使う)
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = draft ?? saved;
  const photoUrl = pickedPhoto ?? (saved.kind === "photo" ? saved.dataUrl : null);
  const photoSelected = selected.kind === "photo";

  const choose = (choice: AvatarChoice) => {
    setError(null);
    setDraft(choice);
  };

  const openPicker = () => {
    setError(null);
    fileInput.current?.click();
  };

  const onPhotoTile = () => {
    if (photoUrl && !photoSelected) choose({ kind: "photo", dataUrl: photoUrl });
    else openPicker();
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ""; // 同じ写真をもう一度えらんでも反応するように
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await photoFileToDataUrl(file);
      setPickedPhoto(dataUrl);
      setDraft({ kind: "photo", dataUrl });
    } catch {
      setError(MSG_DECODE_FAILED);
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = () => {
    if (!save(selected)) {
      setError(MSG_SAVE_FAILED);
      return;
    }
    router.push("/");
  };

  const onBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-4 bg-surface px-5"
      style={{
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <div>
        <IconButton label="もどる" size={60} onClick={onBack} className="text-ink">
          <BackIcon size={28} />
        </IconButton>
      </div>

      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[28px] font-black leading-tight">地図にうつる「わたし」</h1>
        <p className="m-0 text-base text-ink-soft">すきな子をえらんでね。あとで変えられます。</p>
      </header>

      <div
        className="flex h-[150px] flex-none items-center justify-center rounded-[28px] bg-cream"
        aria-live="polite"
      >
        {busy ? (
          <p className="m-0 text-lg font-bold text-ink-soft">写真を読みこんでいます…</p>
        ) : (
          <AvatarFigure
            key={selected.kind === "photo" ? "photo" : selected.animal}
            choice={selected}
            size={selected.kind === "photo" ? 118 : 110}
            title={`えらんだアバター：${avatarLabel(selected)}`}
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3" role="group" aria-label="アバターのえらびかた">
        {ANIMAL_AVATARS.map((a) => {
          const choice: AvatarChoice = { kind: "animal", animal: a.id };
          return (
            <Tile key={a.id} pressed={isSameAvatar(selected, choice)} onClick={() => choose(choice)}>
              <AvatarFigure choice={choice} size={52} />
              <span>{a.label}</span>
            </Tile>
          );
        })}
        <Tile pressed={photoSelected} dashed={!photoUrl} onClick={onPhotoTile} disabled={busy}>
          {photoUrl ? (
            <>
              <AvatarFigure choice={{ kind: "photo", dataUrl: photoUrl }} size={54} />
              <span>写真</span>
            </>
          ) : (
            <>
              <CameraIcon />
              <span className="break-keep">
                写真から
                <wbr />
                つくる
              </span>
            </>
          )}
        </Tile>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="写真をえらぶ"
        data-testid="avatar-photo-input"
        onChange={onFile}
      />

      {photoSelected ? (
        <Button variant="dashed" block onClick={openPicker} disabled={busy}>
          べつの写真をえらぶ
        </Button>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-[20px] bg-primary-soft px-4 py-3.5 text-primary-strong">
          <WarningIcon size={24} className="mt-0.5 flex-none" />
          <p className="m-0 text-base font-bold leading-relaxed">{error}</p>
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-[20px] bg-card px-4 py-3.5 text-ink-soft">
        <LockIcon size={22} className="mt-0.5 flex-none" />
        <p className="m-0 text-[15px] leading-relaxed">
          写真はこのスマホの中だけに保存され、外には送られません。まるく切り抜いてアバターになります。
        </p>
      </div>

      <Button size="lg" block className="mt-auto flex-none" onClick={onConfirm} disabled={busy}>
        この子にする
      </Button>
    </div>
  );
}

function Tile({
  pressed,
  dashed = false,
  onClick,
  disabled,
  children,
}: {
  pressed: boolean;
  dashed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-[112px] min-w-0 flex-col items-center justify-center gap-1 rounded-3xl px-1 text-center",
        "text-[18px] font-bold leading-tight text-ink select-none",
        "transition-[transform,border-color] duration-150 active:scale-[0.97] disabled:opacity-50",
        pressed
          ? "border-[3px] border-primary bg-card shadow-card"
          : dashed
            ? "border-[2.5px] border-dashed border-dash-warm bg-cream"
            : "border-[3px] border-transparent bg-card",
      )}
    >
      {children}
    </button>
  );
}

function CameraIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="mb-1 text-primary-strong"
    >
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8 6l1.5-2h5L16 6" />
    </svg>
  );
}
