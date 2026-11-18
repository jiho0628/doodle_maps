"use client";

import { useEffect, useRef, useState } from "react";
import type { LngLat, Place, RouteStep } from "@/types";
import { fetchRoute } from "./client";
import { distanceM, locateOnRoute, WALK_METERS_PER_MINUTE, type RouteProgress } from "./geo";
import { prepareRoute, type PreparedRoute } from "./navRoute";

/** 目的地からこの距離(m)以内に入ったら「着きました」 */
export const ARRIVE_RADIUS_M = 25;
/** 経路からこれ以上(m)離れたら道を調べなおす */
export const OFF_ROUTE_M = 45;
/** 調べなおしの最短間隔 */
const REROUTE_INTERVAL_MS = 20_000;

export type NavigationError = "too_far" | "no_route" | "error";

export type NavigationPhase =
  | { kind: "locating" }
  | { kind: "routing" }
  | { kind: "navigating" }
  | { kind: "arrived" }
  | { kind: "failed"; error: NavigationError };

export type NavigationView = {
  phase: NavigationPhase;
  route: PreparedRoute | null;
  /** 次に曲がる(または到着する)ところ */
  nextStep: RouteStep | null;
  distanceToNextM: number | null;
  remainingM: number | null;
  remainingS: number | null;
  /** 調べなおし中 */
  rerouting: boolean;
};

/** 経路上の位置から、次の曲がり角と残りを求める(テストしやすいよう純粋関数に分けている) */
export function summarizeProgress(route: PreparedRoute, progress: RouteProgress, position: LngLat) {
  const { stepIndices, cumulative } = route;
  const steps = route.route.steps;
  const total = cumulative[cumulative.length - 1] ?? 0;

  // いまの区間より先にある最初の曲がり角(出発は除く)
  let next = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].turn === "depart") continue;
    if (stepIndices[i] > progress.segmentIndex) {
      next = i;
      break;
    }
  }
  const nextIndex = stepIndices[next] ?? cumulative.length - 1;
  const distanceToNextM = Math.max(0, (cumulative[nextIndex] ?? total) - progress.alongM);

  // 直線の代わり経路のときは、いまの位置から目的地までの直線距離をそのまま使う
  const remainingM = route.approximate
    ? distanceM(position, route.route.destination.position)
    : Math.max(0, total - progress.alongM);
  const pace = route.route.distanceM > 0 && route.route.durationS > 0
    ? route.route.durationS / route.route.distanceM
    : 60 / WALK_METERS_PER_MINUTE;

  return {
    nextStep: steps[next] ?? null,
    distanceToNextM: route.approximate ? remainingM : distanceToNextM,
    remainingM,
    remainingS: remainingM * pace,
  };
}

/**
 * 道案内の進み具合を管理する。
 * 現在地がわかったら経路を取り、歩くたびに「次の曲がり角」「残り」を更新し、
 * 大きく外れたら調べなおし、近づいたら到着にする。
 */
export function useNavigation(destination: Place | null, position: LngLat | null, attempt = 0): NavigationView {
  const [route, setRoute] = useState<PreparedRoute | null>(null);
  const [error, setError] = useState<NavigationError | null>(null);
  const [arrived, setArrived] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<LngLat | null>(null);

  const positionRef = useRef(position);
  const lastRouteAt = useRef(0);
  const offRouteCount = useRef(0);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // 目的地・やり直しが変わったら最初から
  const destinationKey = destination ? `${destination.position.lng},${destination.position.lat}` : null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 目的地が変わったときに状態を戻す
    setRoute(null);
    setError(null);
    setArrived(false);
    setRouteOrigin(null);
    offRouteCount.current = 0;
  }, [destinationKey, attempt]);

  // 最初に現在地がわかったら、そこを出発点にする
  const hasPosition = position !== null;
  useEffect(() => {
    if (hasPosition && !routeOrigin && positionRef.current) {
      setRouteOrigin(positionRef.current);
    }
  }, [hasPosition, routeOrigin]);

  // 出発点が決まったら経路を取る
  useEffect(() => {
    if (!destination || !routeOrigin) return;
    const controller = new AbortController();
    lastRouteAt.current = Date.now();
    fetchRoute(routeOrigin, destination, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setRerouting(false);
        if (result.kind === "ok") {
          setRoute(prepareRoute(result.nav));
          setError(null);
                offRouteCount.current = 0;
        } else if (!route) {
          // 調べなおしの失敗なら、前の経路のまま案内を続ける
          setError(result.kind);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
    // route は「最初の取得かどうか」を見るためだけに使うので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.position.lng, destination?.position.lat, routeOrigin]);

  // 経路上のどこにいるか(前回の位置をヒントに、先へ先へと探す)
  const [tracked, setTracked] = useState<{ route: PreparedRoute; progress: RouteProgress } | null>(null);
  useEffect(() => {
    if (!route || !position) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 位置が変わるたびに経路上の位置を更新する
    setTracked((prev) => ({
      route,
      progress: locateOnRoute(
        position,
        route.route.coordinates,
        route.cumulative,
        prev && prev.route === route ? prev.progress.segmentIndex : 0,
      ),
    }));
  }, [route, position]);
  const progress = tracked && tracked.route === route ? tracked.progress : null;

  // 到着の判定と、外れたときの調べなおし
  useEffect(() => {
    if (!route || !position || !destination || arrived) return;
    if (distanceM(position, destination.position) <= ARRIVE_RADIUS_M) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 位置の変化に応じて到着にする
      setArrived(true);
      return;
    }
    if (!progress || route.approximate) return;
    if (progress.offRouteM > OFF_ROUTE_M) {
      offRouteCount.current += 1;
      // GPS のぶれで1回だけ外れることがあるので、2回続いたら
      if (offRouteCount.current >= 2 && Date.now() - lastRouteAt.current > REROUTE_INTERVAL_MS) {
        offRouteCount.current = 0;
        setRerouting(true);
        setRouteOrigin(position);
      }
    } else {
      offRouteCount.current = 0;
    }
  }, [route, position, destination, progress, arrived]);

  const summary = route && progress && position ? summarizeProgress(route, progress, position) : null;

  let phase: NavigationPhase;
  if (arrived) phase = { kind: "arrived" };
  else if (error) phase = { kind: "failed", error };
  else if (!routeOrigin) phase = { kind: "locating" };
  else if (!route) phase = { kind: "routing" };
  else phase = { kind: "navigating" };

  return {
    phase,
    route,
    nextStep: summary?.nextStep ?? null,
    distanceToNextM: summary?.distanceToNextM ?? null,
    remainingM: summary?.remainingM ?? null,
    remainingS: summary?.remainingS ?? null,
    rerouting,
  };
}
