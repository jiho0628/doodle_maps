"use client";

import { useState } from "react";
import { HeartIcon, IconButton, cn } from "@/components/ui";
import type { Place } from "@/types";
import { useFavorites } from "./useFavorites";

/**
 * ハートの丸ボタン(60/68px)。検索結果などに置くと、押すたびにお気に入りへ入れる/外すを切り替えます。
 *
 *   <FavoriteToggleButton place={place} />
 */
export function FavoriteToggleButton({
  place,
  size = 60,
  className,
  onChange,
}: {
  place: Pick<Place, "name" | "position" | "address" | "category">;
  size?: 60 | 68;
  className?: string;
  /** 入れた/外したあとに呼ばれる(saved=true で入れた) */
  onChange?: (saved: boolean) => void;
}) {
  const { add, remove, findByPosition } = useFavorites();
  const existing = findByPosition(place.position);
  const saved = existing !== undefined;
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    if (existing) {
      const ok = remove(existing.id);
      setFailed(!ok);
      if (ok) onChange?.(false);
    } else {
      const result = add(place);
      setFailed(!result.ok);
      if (result.ok) onChange?.(true);
    }
  };

  return (
    <IconButton
      size={size}
      label={saved ? `${place.name}をお気に入りから外す` : `${place.name}をお気に入りに入れる`}
      aria-pressed={saved}
      title={failed ? "保存できませんでした" : undefined}
      onClick={toggle}
      className={cn(saved ? "bg-primary-soft text-primary-strong" : "text-primary", className)}
    >
      <HeartIcon size={size === 68 ? 32 : 28} filled={saved} />
    </IconButton>
  );
}
