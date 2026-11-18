import type { Metadata } from "next";
import { FavoritesScreen } from "@/features/favorites";

export const metadata: Metadata = { title: "お気に入り" };

export default function FavoritesPage() {
  return <FavoritesScreen />;
}
