/**
 * お気に入り画面の「地図で見る」→ 地図ホームでその場所を開く、の受け渡し。
 * cacheComponents 下で検索パラメータを使うと Suspense が必要になるため、URL の # を使います。
 */
const PREFIX = "#fav=";

export function mapHrefForFavorite(id: string): string {
  return `/${PREFIX}${encodeURIComponent(id)}`;
}

export function parseFavoriteHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  const id = decodeURIComponent(hash.slice(PREFIX.length));
  return id || null;
}
