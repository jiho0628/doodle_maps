/**
 * 下タブの画面と全画面(さがす・アバターなど)を行き来したときに作り直される入れ物。
 * 画面が変わったことが分かるよう、中身をふわっと(200ms)出します。
 * 下タブどうしの切りかえでは作り直されません((tabs)/template.tsx が担当)。
 */
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
