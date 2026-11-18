import type { ComponentProps } from "react";
import { cn } from "./cn";

/** 白い角丸カード(リスト項目・地図上の案内パネルなど) */
export function Card({
  className,
  elevated = false,
  ...rest
}: ComponentProps<"div"> & {
  /** 地図の上に浮かせるときは true(影が強くなる) */
  elevated?: boolean;
}) {
  return (
    <div
      className={cn("rounded-3xl bg-card p-4", elevated ? "shadow-float" : "shadow-card", className)}
      {...rest}
    />
  );
}
