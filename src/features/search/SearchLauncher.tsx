import Link from "next/link";
import { SearchIcon } from "@/components/ui";
import { MapOverlay } from "@/features/map/MapOverlay";

/** 地図ホーム上部の「どこへ行く？」ボタン。押すと検索画面へ。 */
export function SearchLauncher() {
  return (
    <MapOverlay position="top">
      <Link
        href="/search"
        className="flex h-[68px] w-full items-center gap-3.5 rounded-full bg-card px-6 text-xl font-bold text-ink-soft no-underline shadow-soft active:scale-[0.98]"
      >
        <span className="text-primary">
          <SearchIcon size={28} />
        </span>
        どこへ行く？
      </Link>
    </MapOverlay>
  );
}
