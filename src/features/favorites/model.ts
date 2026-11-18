import type { Favorite, FavoriteIcon, LngLat, Place, PlaceCategory } from "@/types";

/** お気に入りの名前の最大文字数(長すぎると一覧で読みにくい) */
export const FAVORITE_NAME_MAX = 30;

/** この距離(m)より近い場所は「同じ場所」とみなす */
export const SAME_SPOT_METERS = 30;

export const FAVORITE_ICONS: readonly FavoriteIcon[] = ["home", "school", "cafe", "shop", "heart"];

export const FAVORITE_ICON_LABELS: Record<FavoriteIcon, string> = {
  home: "おうち",
  school: "学校",
  cafe: "カフェ",
  shop: "お店",
  heart: "ほか",
};

const ICON_SET = new Set<string>(FAVORITE_ICONS);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isLngLat(v: unknown): v is LngLat {
  if (typeof v !== "object" || v === null) return false;
  const { lng, lat } = v as Record<string, unknown>;
  return isFiniteNumber(lng) && isFiniteNumber(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function isFavorite(v: unknown): v is Favorite {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return (
    typeof f.id === "string" &&
    f.id.length > 0 &&
    typeof f.name === "string" &&
    (f.address === undefined || typeof f.address === "string") &&
    isLngLat(f.position) &&
    typeof f.icon === "string" &&
    ICON_SET.has(f.icon) &&
    typeof f.createdAt === "string"
  );
}

/** 保存値の検証。1件でも壊れていたら全体を捨てず、壊れた項目だけ除く方が親切だが、
 *  useStoredState の validate は「全体が正しいか」を返す必要があるため、配列かどうかだけを見て
 *  中身は sanitizeFavorites で整える。 */
export function isFavoriteArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/** 壊れた項目・重複 id を取り除く */
export function sanitizeFavorites(list: readonly unknown[]): Favorite[] {
  const seen = new Set<string>();
  const out: Favorite[] = [];
  for (const item of list) {
    if (!isFavorite(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** 名前を整える(前後の空白を取り、長すぎたら切る)。空なら fallback。 */
export function normalizeName(name: string, fallback = "お気に入りの場所"): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
  return Array.from(trimmed).slice(0, FAVORITE_NAME_MAX).join("");
}

/** 場所の種類から最初のアイコンを決める */
export function iconForCategory(category?: PlaceCategory): FavoriteIcon {
  switch (category) {
    case "home":
      return "home";
    case "school":
      return "school";
    case "cafe":
      return "cafe";
    case "convenience":
      return "shop";
    default:
      return "heart";
  }
}

/** 2点間の距離(m)。お気に入りの重複判定用なので簡易計算で十分。 */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 同じ場所がもう保存されていれば、そのお気に入りを返す */
export function findSameSpot(list: readonly Favorite[], position: LngLat): Favorite | undefined {
  return list.find((f) => distanceMeters(f.position, position) <= SAME_SPOT_METERS);
}

export function newFavoriteId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return `fav_${c.randomUUID()}`;
  return `fav_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type NewFavoriteInput = Pick<Place, "name" | "position"> &
  Partial<Pick<Place, "address" | "category">> & { icon?: FavoriteIcon };

export function createFavorite(input: NewFavoriteInput, now: Date = new Date()): Favorite {
  const fav: Favorite = {
    id: newFavoriteId(),
    name: normalizeName(input.name),
    position: { lng: input.position.lng, lat: input.position.lat },
    icon: input.icon ?? iconForCategory(input.category),
    createdAt: now.toISOString(),
  };
  if (input.address) fav.address = input.address;
  if (input.category) fav.category = input.category;
  return fav;
}

export type AddResult = { list: Favorite[]; favorite: Favorite; added: boolean };

/**
 * 一覧に追加する。同じ場所がすでにあれば追加せず、そのお気に入りを返す。
 * 新しいものは先頭に入る(すぐ見つかるように)。
 */
export function addToList(list: readonly Favorite[], input: NewFavoriteInput, now?: Date): AddResult {
  const existing = findSameSpot(list, input.position);
  if (existing) return { list: [...list], favorite: existing, added: false };
  const favorite = createFavorite(input, now);
  return { list: [favorite, ...list], favorite, added: true };
}

export type FavoritePatch = Partial<Pick<Favorite, "name" | "icon">>;

export function updateInList(list: readonly Favorite[], id: string, patch: FavoritePatch): Favorite[] {
  return list.map((f) => {
    if (f.id !== id) return f;
    const next = { ...f };
    if (patch.name !== undefined) next.name = normalizeName(patch.name, f.name);
    if (patch.icon !== undefined && ICON_SET.has(patch.icon)) next.icon = patch.icon;
    return next;
  });
}

export function removeFromList(list: readonly Favorite[], id: string): Favorite[] {
  return list.filter((f) => f.id !== id);
}
