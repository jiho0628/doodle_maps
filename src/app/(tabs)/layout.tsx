import { BottomTabBar } from "@/components/layout/BottomTabBar";

/** 下タブ付きの画面(地図・お気に入り)の共通レイアウト */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <main className="relative min-h-0 flex-1">{children}</main>
      <BottomTabBar />
    </div>
  );
}
