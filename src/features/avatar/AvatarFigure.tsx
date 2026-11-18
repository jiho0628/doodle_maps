import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import type { AnimalAvatarId, AvatarChoice } from "@/types/avatar";

/*
 * アバターの絵。A案デザインのオリジナル動物(viewBox 0 0 76 84)。
 * 色は globals.css のトークン(fill-fur-bear など)だけを使う。
 */

const line = "stroke-ink";

const ANIMAL_DRAWINGS: Record<AnimalAvatarId, ReactNode> = {
  rabbit: (
    <>
      <ellipse cx="26" cy="20" rx="9" ry="20" className={cn("fill-card", line)} strokeWidth="3" />
      <ellipse cx="50" cy="20" rx="9" ry="20" className={cn("fill-card", line)} strokeWidth="3" />
      <ellipse cx="26" cy="22" rx="4" ry="12" className="fill-blush" />
      <ellipse cx="50" cy="22" rx="4" ry="12" className="fill-blush" />
      <circle cx="38" cy="54" r="27" className={cn("fill-card", line)} strokeWidth="3" />
      <circle cx="29" cy="52" r="3.4" className="fill-ink" />
      <circle cx="47" cy="52" r="3.4" className="fill-ink" />
      <path d="M34 61 Q38 65 42 61" fill="none" className={line} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="23" cy="61" rx="5" ry="3" className="fill-blush" />
      <ellipse cx="53" cy="61" rx="5" ry="3" className="fill-blush" />
    </>
  ),
  bear: (
    <>
      <circle cx="16" cy="32" r="10" className={cn("fill-fur-bear", line)} strokeWidth="3" />
      <circle cx="60" cy="32" r="10" className={cn("fill-fur-bear", line)} strokeWidth="3" />
      <circle cx="38" cy="54" r="27" className={cn("fill-fur-bear", line)} strokeWidth="3" />
      <ellipse cx="38" cy="62" rx="11" ry="8" className="fill-fur-bear-muzzle" />
      <circle cx="28" cy="50" r="3.4" className="fill-ink" />
      <circle cx="48" cy="50" r="3.4" className="fill-ink" />
      <ellipse cx="38" cy="59" rx="3.5" ry="2.5" className="fill-ink" />
    </>
  ),
  cat: (
    <>
      <path d="M14 44 L16 18 L34 30 Z" className={cn("fill-fur-cat", line)} strokeWidth="3" strokeLinejoin="round" />
      <path d="M62 44 L60 18 L42 30 Z" className={cn("fill-fur-cat", line)} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="38" cy="54" r="27" className={cn("fill-fur-cat", line)} strokeWidth="3" />
      <path d="M27 53 q2 -4 4 0 M45 53 q2 -4 4 0" fill="none" className={line} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M34 60 q4 4 8 0" fill="none" className={line} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 58h10M54 58h10" className={line} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  chick: (
    <>
      <path d="M36 28 q-4 -10 2 -14 q0 8 6 10" fill="none" className={line} strokeWidth="3" strokeLinecap="round" />
      <circle cx="38" cy="54" r="27" className={cn("fill-fur-chick", line)} strokeWidth="3" />
      <circle cx="29" cy="50" r="3.4" className="fill-ink" />
      <circle cx="47" cy="50" r="3.4" className="fill-ink" />
      <path d="M33 57 L43 57 L38 64 Z" className={cn("fill-beak-chick", line)} strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  penguin: (
    <>
      <circle cx="38" cy="54" r="27" className={cn("fill-fur-penguin", line)} strokeWidth="3" />
      <ellipse cx="38" cy="60" rx="18" ry="16" className="fill-card" />
      <circle cx="31" cy="55" r="3.2" className="fill-ink" />
      <circle cx="45" cy="55" r="3.2" className="fill-ink" />
      <path d="M34 62 L42 62 L38 67 Z" className="fill-beak-penguin" />
    </>
  ),
};

/**
 * えらんだアバターを描く。
 * - 動物: 幅 size・高さ size×84/76 の SVG
 * - 写真: size×size の丸い画像(白いふち付き)
 * title を渡すと読み上げ名付きの画像(role="img")、なければ飾り(aria-hidden)。
 */
export function AvatarFigure({
  choice,
  size,
  className,
  title,
}: {
  choice: AvatarChoice;
  size: number;
  className?: string;
  title?: string;
}) {
  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);

  if (choice.kind === "photo") {
    return (
      // data URL をそのまま出すので next/image は使わない
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={choice.dataUrl}
        width={size}
        height={size}
        alt={title ?? ""}
        aria-hidden={title ? undefined : true}
        draggable={false}
        className={cn(
          "block flex-none rounded-full border-card object-cover shadow-card",
          size >= 80 ? "border-4" : "border-[3px]",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={Math.round((size * 84) / 76)}
      viewBox="0 0 76 84"
      focusable="false"
      className={cn("block flex-none", className)}
      {...a11y}
    >
      {ANIMAL_DRAWINGS[choice.animal]}
    </svg>
  );
}
