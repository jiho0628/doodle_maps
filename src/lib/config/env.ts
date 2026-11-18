/**
 * 環境変数の読み口。ここ以外で process.env を直接読まないでください。
 *
 * NEXT_PUBLIC_ で始まる値はビルド時にブラウザ用コードへ埋め込まれます。
 * Next.js は `process.env.NEXT_PUBLIC_XXX` という書き方を文字通り置換するため、
 * 動的なキー参照(process.env[name])にはしないこと。
 */

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

export const publicEnv = {
  /** MapTiler のAPIキー(地図タイル・ジオコーディング用。ブラウザに公開される) */
  maptilerKey: clean(process.env.NEXT_PUBLIC_MAPTILER_KEY),
  /** MapTiler の地図スタイルID(例: streets-v2, basic-v2, pastel) */
  maptilerStyle: clean(process.env.NEXT_PUBLIC_MAPTILER_STYLE) || "streets-v2",
} as const;

/**
 * サーバー専用の値。クライアントコンポーネントから import しないこと。
 * (OpenRouteService のキーは Route Handler 経由でのみ使う想定)
 */
export function getServerEnv() {
  return {
    orsApiKey: clean(process.env.ORS_API_KEY),
  } as const;
}
