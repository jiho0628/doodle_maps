import type { LngLat } from "@/types";

/** 位置情報が取れないときの初期表示(東京駅) */
export const DEFAULT_CENTER: LngLat = { lng: 139.7671, lat: 35.6812 };
export const DEFAULT_ZOOM = 15;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;

/** キー未設定時に使う、キー不要の地図スタイル(OpenFreeMap) */
export const FALLBACK_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
