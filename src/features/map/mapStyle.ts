import { FALLBACK_STYLE_URL } from "./constants";

export type MapStyleSource = "maptiler" | "fallback";

export type ResolvedMapStyle = {
  url: string;
  source: MapStyleSource;
};

/**
 * 使う地図スタイルを決める。
 * MapTiler のキーがあれば MapTiler、なければキー不要の代替スタイルにする。
 */
export function resolveMapStyle(opts: { maptilerKey: string; maptilerStyle: string }): ResolvedMapStyle {
  const key = opts.maptilerKey.trim();
  if (!key) {
    return { url: FALLBACK_STYLE_URL, source: "fallback" };
  }
  const style = encodeURIComponent(opts.maptilerStyle.trim() || "streets-v2");
  return {
    url: `https://api.maptiler.com/maps/${style}/style.json?key=${encodeURIComponent(key)}`,
    source: "maptiler",
  };
}
