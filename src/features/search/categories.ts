import type { PlaceCategory } from "@/types";

/** 検索画面の「よく使う」ボタン */
export type SearchCategory = {
  id: Extract<PlaceCategory, "cafe" | "convenience" | "station" | "toilet">;
  label: string;
  /** OpenStreetMap(Overpass)での探し方 */
  overpassFilter: string;
  /** 探す半径(m) */
  radiusM: number;
  /** 名前がない場所に付ける名前(名前なしは出さないなら undefined) */
  unnamedLabel?: string;
};

export const SEARCH_CATEGORIES: SearchCategory[] = [
  { id: "cafe", label: "カフェ", overpassFilter: '["amenity"="cafe"]', radiusM: 1200 },
  { id: "convenience", label: "コンビニ", overpassFilter: '["shop"="convenience"]', radiusM: 1200 },
  { id: "station", label: "駅", overpassFilter: '["railway"="station"]', radiusM: 3000 },
  { id: "toilet", label: "トイレ", overpassFilter: '["amenity"="toilets"]', radiusM: 1000, unnamedLabel: "公衆トイレ" },
];

export function findCategory(id: string): SearchCategory | undefined {
  return SEARCH_CATEGORIES.find((c) => c.id === id);
}
