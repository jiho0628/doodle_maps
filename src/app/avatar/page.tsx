import type { Metadata } from "next";
import { AvatarScreen } from "@/features/avatar";

export const metadata: Metadata = { title: "アバター" };

/** アバター選び(下タブなし・全画面) */
export default function AvatarPage() {
  return <AvatarScreen />;
}
