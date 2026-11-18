"use client";

import { useSyncExternalStore } from "react";
import { INITIAL_LOCATION, locationStore, type LocationState } from "./geolocationStore";
import { headingStore, INITIAL_HEADING, type HeadingState } from "./headingStore";

/**
 * 現在地。どの部品から何回呼んでも GPS の監視は1本だけ。
 *
 *   const { status, position } = useCurrentLocation();
 *   if (status === "ok" && position) map.flyTo({ center: [position.lng, position.lat] });
 */
export function useCurrentLocation(): LocationState {
  return useSyncExternalStore(locationStore.subscribe, locationStore.getSnapshot, () => INITIAL_LOCATION);
}

/** 拒否・取得失敗のあとに、もう一度現在地を取りに行く */
export function retryLocation(): void {
  locationStore.retry();
}

/**
 * スマホの向き(北=0 の時計回りの度数)。画面の回転も補正済み。
 * iPhone では requestCompassPermission() を呼ぶまで status は "needs-permission"。
 */
export function useHeading(): HeadingState {
  return useSyncExternalStore(headingStore.subscribe, headingStore.getSnapshot, () => INITIAL_HEADING);
}

/** 向きの許可をもらう(iPhone)。必ずボタンのタップ処理の中で呼ぶこと。 */
export function requestCompassPermission(): Promise<boolean> {
  return headingStore.requestPermission();
}
