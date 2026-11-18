import type { RouteTurn } from "@/types";

/**
 * OpenRouteService の instruction type → 曲がり方。
 * https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/instruction-types
 */
const ORS_TYPES: Record<number, RouteTurn> = {
  0: "left",
  1: "right",
  2: "sharp-left",
  3: "sharp-right",
  4: "slight-left",
  5: "slight-right",
  6: "straight",
  7: "roundabout",
  8: "roundabout",
  9: "u-turn",
  10: "arrive",
  11: "depart",
  12: "keep-left",
  13: "keep-right",
};

export function turnFromOrsType(type: unknown): RouteTurn | undefined {
  return typeof type === "number" ? ORS_TYPES[type] : undefined;
}

/** 画面に大きく出す短い言葉。ORS の文章より短く、迷いにくい言い方にそろえる */
const LABELS: Record<RouteTurn, string> = {
  depart: "出発",
  straight: "まっすぐ進む",
  left: "左へ曲がる",
  right: "右へ曲がる",
  "slight-left": "ななめ左へ",
  "slight-right": "ななめ右へ",
  "sharp-left": "大きく左へ曲がる",
  "sharp-right": "大きく右へ曲がる",
  "keep-left": "左側の道へ",
  "keep-right": "右側の道へ",
  "u-turn": "引き返す",
  roundabout: "ロータリーを進む",
  arrive: "目的地に到着",
};

export function turnLabel(turn: RouteTurn | undefined): string {
  return turn ? LABELS[turn] : "道なりに進む";
}
