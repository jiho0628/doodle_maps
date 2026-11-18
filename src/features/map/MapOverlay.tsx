import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * 地図の上に部品を置くための入れ物。
 * 置き場所ごとに縦に積まれるので、機能同士で座標を取り合わずに済みます。
 *
 *  - top:          画面上部(検索ボタン、ルート案内の曲がり角表示)
 *  - bottom-right: 右下(現在地ボタンなど丸いボタン)
 *  - bottom:       下部(案内カード、向きの許可のお願いなど)
 */
export type MapOverlayPosition = "top" | "bottom-right" | "bottom";

const positions: Record<MapOverlayPosition, string> = {
  top: "top-0 inset-x-0 px-5 flex-col",
  "bottom-right": "bottom-0 right-0 px-5 pb-4 flex-col items-end",
  bottom: "bottom-0 inset-x-0 px-4 pb-4 flex-col",
};

export function MapOverlay({
  position,
  children,
  className,
}: {
  position: MapOverlayPosition;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-map-overlay={position}
      className={cn("pointer-events-none absolute z-10 flex gap-3 [&>*]:pointer-events-auto", positions[position], className)}
      style={position === "top" ? { paddingTop: "max(20px, env(safe-area-inset-top))" } : undefined}
    >
      {children}
    </div>
  );
}
