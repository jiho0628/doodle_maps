"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Place } from "@/types";

/**
 * ルート案内の入口。お気に入りから「行く」を押したときはここだけを通ります。
 * 案内画面(/navigate、検索+ルート案内担当)はこの URL 形式で目的地を受け取ります。
 */
export function routeHref(place: Pick<Place, "name" | "position" | "address">): string {
  const params = new URLSearchParams({
    lng: String(place.position.lng),
    lat: String(place.position.lat),
    name: place.name,
  });
  if (place.address) params.set("address", place.address);
  return `/navigate?${params.toString()}`;
}

/** 押して1回でルート案内を始める関数を返す */
export function useStartRoute() {
  const router = useRouter();
  return useCallback((place: Pick<Place, "name" | "position" | "address">) => router.push(routeHref(place)), [router]);
}
