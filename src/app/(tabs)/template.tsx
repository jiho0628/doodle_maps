/**
 * タブを切りかえるたびに作り直される入れ物。
 * 切りかえたことが分かるよう、中身をふわっと(200ms)出します。
 */
export default function TabsTemplate({ children }: { children: React.ReactNode }) {
  return <div className="h-full animate-fade-in">{children}</div>;
}
