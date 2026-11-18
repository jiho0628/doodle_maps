import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/**
 * A案の共通ボタン。高さは最低 60px、文字は 18px 以上。
 *
 * variant:
 *  - primary: コーラルの塗り(いちばん大事な操作。1画面に1つが目安)
 *  - soft:    淡いピンク(「案内をおわる」など、目立たせすぎない操作)
 *  - white:   白地に影(地図の上に浮かせるボタン)
 *  - dashed:  点線枠(「いまいる場所を保存」などの追加操作)
 */
export type ButtonVariant = "primary" | "soft" | "white" | "dashed";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold select-none " +
  "transition-[transform,background-color,opacity] duration-150 active:scale-[0.97] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-strong",
  soft: "bg-primary-soft text-primary-strong hover:bg-blush",
  white: "bg-card text-ink-soft shadow-soft hover:bg-surface",
  dashed: "bg-transparent text-primary-strong border-[2.5px] border-dashed border-dash hover:bg-primary-soft/40",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-[60px] px-6 text-[19px]",
  lg: "min-h-16 px-7 text-xl",
};

export function buttonClassName(opts: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  const { variant = "primary", size = "md", block = false, className } = opts;
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 横幅いっぱい */
  block?: boolean;
  /** 文字の前に出すアイコン */
  icon?: ReactNode;
};

export function Button({
  variant,
  size,
  block,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClassName({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/** 見た目がボタンのリンク(画面遷移用) */
export function ButtonLink({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClassName({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
