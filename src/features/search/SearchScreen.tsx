import Link from "next/link";
import { BackIcon, Card } from "@/components/ui";

/**
 * 検索画面(仮)。
 * 「検索+ルート案内」担当がこのファイルを置き換えます。
 */
export function SearchScreen() {
  return (
    <div className="flex min-h-dvh flex-col gap-6 bg-surface px-5 pb-6" style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          aria-label="地図にもどる"
          className="flex size-[60px] flex-none items-center justify-center rounded-full bg-card text-ink shadow-card"
        >
          <BackIcon size={28} />
        </Link>
        <h1 className="m-0 text-2xl font-black">さがす</h1>
      </div>
      <Card className="p-6 text-lg leading-relaxed text-ink-soft">場所さがしは、ただいま準備中です。</Card>
    </div>
  );
}
