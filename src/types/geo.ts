/** 経度・緯度。MapLibre の [lng, lat] 配列と取り違えないよう名前付きにしています。 */
export type LngLat = {
  lng: number;
  lat: number;
};

/** 地図上の場所(検索結果・お気に入り・目的地で共通) */
export type Place = {
  id: string;
  name: string;
  /** 住所や補足(「東京都千代田区…」など) */
  address?: string;
  position: LngLat;
  category?: PlaceCategory;
};

export type PlaceCategory = "cafe" | "convenience" | "station" | "toilet" | "home" | "school" | "other";

export function toLngLatArray(p: LngLat): [number, number] {
  return [p.lng, p.lat];
}

export function fromLngLatArray([lng, lat]: [number, number]): LngLat {
  return { lng, lat };
}
