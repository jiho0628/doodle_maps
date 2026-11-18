/**
 * localStorage のキー一覧。キーは必ずここに追加してください
 * (機能ごとに勝手な文字列を使うと衝突・取りこぼしの原因になります)。
 * 実際の保存名は先頭に "doodle_maps:" が付きます。
 */
export const STORAGE_KEYS = {
  /** お気に入り一覧: Favorite[] */
  favorites: "favorites",
  /** 選んだアバター: AvatarChoice */
  avatar: "avatar",
  /** 最後に見ていた地図の位置: { center: LngLat; zoom: number } */
  mapCamera: "map.camera",
  /** 向き(コンパス)の案内を一度出したか: boolean */
  compassPrompted: "compass.prompted",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export const STORAGE_PREFIX = "doodle_maps:";
