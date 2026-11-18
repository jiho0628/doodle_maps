import type { Metadata } from "next";
import { SearchScreen } from "@/features/search";

export const metadata: Metadata = { title: "さがす" };

/** 検索画面(下タブなし・全画面) */
export default function SearchPage() {
  return <SearchScreen />;
}
