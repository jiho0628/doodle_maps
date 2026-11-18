import type { Place } from "./geo";

export type FavoriteIcon = "home" | "school" | "cafe" | "shop" | "heart";

export type Favorite = Place & {
  icon: FavoriteIcon;
  /** ISO 8601 */
  createdAt: string;
};
