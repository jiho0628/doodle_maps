import { ButtonLink, Card, HeartIcon, ScreenHeader } from "@/components/ui";

/**
 * お気に入り画面(仮)。
 * 「お気に入り」担当がこのファイルを置き換えます(保存は STORAGE_KEYS.favorites)。
 */
export function FavoritesScreen() {
  return (
    <div className="h-full overflow-y-auto px-5 pb-6" style={{ paddingTop: "max(28px, env(safe-area-inset-top))" }}>
      <div className="flex flex-col gap-4">
        <ScreenHeader title="お気に入り" />
        <Card className="flex flex-col items-center gap-4 px-6 py-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-[20px] bg-primary-soft text-primary-strong">
            <HeartIcon size={34} />
          </span>
          <p className="m-0 text-xl font-bold">まだ何も入っていません</p>
          <p className="m-0 text-base leading-relaxed text-ink-soft">
            よく行く場所を登録しておくと、
            <br />
            ここからすぐに道案内できます。
          </p>
          <ButtonLink href="/" variant="soft" block>
            地図を見る
          </ButtonLink>
        </Card>
      </div>
    </div>
  );
}
