import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/**
 * 丸いアイコンだけのボタン(現在地ボタン、もどるボタンなど)。
 * 文字がないので aria-label は必須です。
 */
export function IconButton({
  label,
  children,
  size = 68,
  className,
  type = "button",
  ...rest
}: {
  /** 読み上げ用の名前(例:「現在地にもどる」) */
  label: string;
  children: ReactNode;
  /** 直径(px)。60 以上にしてください */
  size?: 60 | 68;
} & Omit<ComponentProps<"button">, "aria-label">) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full bg-card text-primary shadow-soft",
        "transition-transform duration-150 active:scale-95",
        size === 68 ? "size-[68px]" : "size-[60px]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
