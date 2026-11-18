import { Suspense } from "react";
import type { Metadata } from "next";
import { NavigateScreen } from "@/features/route";

export const metadata: Metadata = { title: "道案内" };

/** 道案内中の画面(下タブなし・全画面)。/navigate?lng=&lat=&name= */
export default function NavigatePage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-cream" />}>
      <NavigateScreen />
    </Suspense>
  );
}
