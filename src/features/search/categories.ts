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
  /** 文字で入れられたときにこのカテゴリとみなす言葉(ひらがな・カタカナ・英語の言い換え) */
  aliases: string[];
};

export const SEARCH_CATEGORIES: SearchCategory[] = [
  { id: "cafe", label: "カフェ", overpassFilter: '["amenity"="cafe"]', radiusM: 1200, aliases: ["かふぇ", "喫茶", "喫茶店", "きっさてん", "コーヒー", "珈琲", "cafe", "coffee"] },
  { id: "convenience", label: "コンビニ", overpassFilter: '["shop"="convenience"]', radiusM: 1200, aliases: ["こんびに", "コンビニエンスストア", "コンビニー", "convenience", "conbini", "konbini"] },
  { id: "station", label: "駅", overpassFilter: '["railway"="station"]', radiusM: 3000, aliases: ["えき", "近くの駅", "station"] },
  { id: "toilet", label: "トイレ", overpassFilter: '["amenity"="toilets"]', radiusM: 1000, unnamedLabel: "公衆トイレ", aliases: ["といれ", "お手洗い", "おてあらい", "手洗い", "便所", "公衆トイレ", "toilet", "wc"] },
];

export function findCategory(id: string): SearchCategory | undefined {
  return SEARCH_CATEGORIES.find((c) => c.id === id);
}

/** 入れられた言葉の前後の「近くの」「さがす」などを外して、比べやすくする */
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^(近くの|ちかくの|この辺の|このへんの|近所の)/, "")
    .replace(/(を?(さがす|探す|探して|さがして)|はどこ|どこ|に行きたい|へ行きたい|行きたい)$/, "");
}

/**
 * 「コンビニ」「近くのカフェ」のようにカテゴリそのものを入れたときに、そのカテゴリを返す。
 * (MapTiler の文字検索は店名でしか探せないため、近くの店をさがす方に回す)
 */
export function matchCategory(text: string): SearchCategory | undefined {
  const q = normalize(text);
  if (!q) return undefined;
  return SEARCH_CATEGORIES.find((c) => [c.label, ...c.aliases].some((w) => normalize(w) === q));
}
