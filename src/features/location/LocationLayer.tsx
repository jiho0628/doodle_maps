"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { IconButton, LocateIcon } from "@/components/ui";
import { MapOverlay, useMap } from "@/features/map";
import { AvatarFigure, avatarLabel, useAvatar } from "@/features/avatar";
import { STORAGE_KEYS, useStoredState } from "@/lib/storage";
import { toLngLatArray, type LngLat } from "@/types";
import { CompassPromptCard } from "./CompassPromptCard";
import { requestCompassPermission, retryLocation, useCurrentLocation, useHeading } from "./hooks";
import { detectPlatform, LocationHelpCard, type DevicePlatform } from "./LocationHelpCard";
import { UserLocationMarker } from "./UserLocationMarker";

/** 現在地へ寄るときのズーム(これより引いているときだけ寄る) */
const FOCUS_ZOOM = 16;

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/** 現在地を追うための移動に付ける印(ほかの移動と見分けるため) */
const FOLLOW_EVENT = { byUserFollow: true } as const;

const noopSubscribe = () => () => {};

function usePlatform(): DevicePlatform {
  return useSyncExternalStore(
    noopSubscribe,
    () => detectPlatform(navigator),
    () => "other" as DevicePlatform,
  );
}

/** 地図を現在地へ動かす関数を返す */
function useFlyToUser() {
  const { map } = useMap();
  return useCallback(
    (position: LngLat, animate = true) => {
      if (!map) return;
      const options = { center: toLngLatArray(position), zoom: Math.max(map.getZoom(), FOCUS_ZOOM) };
      if (animate) map.flyTo({ ...options, duration: 900 }, FOLLOW_EVENT);
      else map.jumpTo(options, FOLLOW_EVENT);
    },
    [map],
  );
}

/**
 * 地図ホームに置く「現在地まわり」一式。(tabs)/page.tsx に1行置くだけで動きます。
 *  - 現在地のアバター+向きの扇形
 *  - 開いたとき一度だけ現在地へ移動
 *  - 右下: アバターを変えるボタン / 現在地にもどるボタン
 *  - 下: 位置情報が使えないときの案内 / iPhone の向きの許可のお願い(初回だけ)
 */
export function LocationLayer() {
  const { map } = useMap();
  const location = useCurrentLocation();
  const compass = useHeading();
  const platform = usePlatform();
  const flyToUser = useFlyToUser();

  const [compassPrompted, setCompassPrompted] = useStoredState(STORAGE_KEYS.compassPrompted, false, isBoolean);
  const [compassEnabled, setCompassEnabled] = useStoredState(STORAGE_KEYS.compassEnabled, false, isBoolean);
  const [helpDismissed, setHelpDismissed] = useState(false);
  // 「ついていく」モード: 開いた直後と「現在地にもどる」を押したあとは、歩くと地図がついてくる。
  // 指で地図を動かしたり、お気に入り・検索などほかの機能が地図を動かしたら、勝手に戻らないようにやめる。
  const following = useRef(true);
  const centeredOnce = useRef(false);

  useEffect(() => {
    if (!map) return;
    const onMoveStart = (event: object) => {
      if (!(event as { byUserFollow?: boolean }).byUserFollow) following.current = false;
    };
    map.on("movestart", onMoveStart);
    return () => {
      map.off("movestart", onMoveStart);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !location.position || !following.current) return;
    if (!centeredOnce.current) {
      // 開いて最初に現在地が取れたら、すぐにそこを映す
      centeredOnce.current = true;
      flyToUser(location.position, false);
      return;
    }
    map.easeTo({ center: toLngLatArray(location.position), duration: 600 }, FOLLOW_EVENT);
  }, [map, location.position, flyToUser]);

  // iPhone: 以前「はい、出す」と答えた人は、次に画面に触れたときに黙って許可を取り直す
  // (Safari は再読みこみで許可を忘れることがあり、許可の要求はタップの中でしかできないため)
  useEffect(() => {
    if (compass.status !== "needs-permission" || !compassEnabled) return;
    const onFirstTouch = () => void requestCompassPermission();
    window.addEventListener("pointerup", onFirstTouch, { once: true, capture: true });
    return () => window.removeEventListener("pointerup", onFirstTouch, { capture: true });
  }, [compass.status, compassEnabled]);

  const onLocate = () => {
    following.current = true;
    if (location.status === "ok" && location.position) {
      flyToUser(location.position);
      return;
    }
    setHelpDismissed(false);
    // 取れたら「ついていく」モードでそこへ移動する
    if (location.status === "denied" || location.status === "unavailable") retryLocation();
  };

  const onAcceptCompass = async () => {
    setCompassPrompted(true);
    const granted = await requestCompassPermission();
    setCompassEnabled(granted);
  };

  const onDeclineCompass = () => {
    setCompassPrompted(true);
    setCompassEnabled(false);
  };

  const showHelp =
    !helpDismissed && (location.status === "denied" || location.status === "unavailable" || location.status === "unsupported");
  const showCompassPrompt =
    !showHelp && location.status === "ok" && compass.status === "needs-permission" && !compassPrompted;

  const locateButton = (
      <IconButton
        label="現在地にもどる"
        onClick={onLocate}
        aria-busy={location.status === "locating" || undefined}
        className={location.status === "locating" ? "animate-pulse" : undefined}
      >
        <LocateIcon size={30} />
      </IconButton>
  );

  const card = showHelp ? (
    <LocationHelpCard
      status={location.status}
      platform={platform}
      onRetry={() => {
        following.current = true;
        retryLocation();
        setHelpDismissed(true);
      }}
      onClose={() => setHelpDismissed(true)}
    />
  ) : showCompassPrompt ? (
    <CompassPromptCard onAccept={onAcceptCompass} onDecline={onDeclineCompass} />
  ) : null;

  return (
    <>
      <UserLocationMarker />
      <MapOverlay position="bottom-right">
        {/* 小さい画面でもはみ出さないよう、自分のカードを出す間は現在地ボタンだけにする */}
        {card ? null : <AvatarButton />}
        {locateButton}
        <BottomOverlaySpacer />
      </MapOverlay>
      {card ? <MapOverlay position="bottom">{card}</MapOverlay> : null}
    </>
  );
}

/**
 * 右下のボタンが、下部のカード(この機能の案内、お気に入りのカードなど、どの機能のものでも)に
 * 重ならないよう、下部に出ているものの高さぶんだけ持ち上げる。
 */
function BottomOverlaySpacer() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const root = ref.current?.closest("[data-map-overlay]")?.parentElement;
    if (!root || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      let h = 0;
      root.querySelectorAll<HTMLElement>(':scope > [data-map-overlay="bottom"]').forEach((el) => {
        // MapOverlay の下の余白(pb-4)はボタン側にもあるので差し引く
        const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
        h = Math.max(h, el.offsetHeight > pad ? el.offsetHeight - pad : 0);
      });
      setHeight(h);
    };
    const resize = new ResizeObserver(measure);
    const observeAll = () => {
      resize.disconnect();
      root.querySelectorAll<HTMLElement>(':scope > [data-map-overlay="bottom"]').forEach((el) => resize.observe(el));
      measure();
    };
    const mutation = new MutationObserver(observeAll);
    mutation.observe(root, { childList: true });
    observeAll();
    return () => {
      mutation.disconnect();
      resize.disconnect();
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="pointer-events-none! -mt-3" style={{ height }} />;
}

/** 右下の「アバターをえらぶ」ボタン。今のアバターの顔が出る。 */
function AvatarButton() {
  const router = useRouter();
  const [avatar] = useAvatar();
  return (
    <IconButton label={`アバターをえらぶ(いまは${avatarLabel(avatar)})`} onClick={() => router.push("/avatar")} className="overflow-hidden">
      <AvatarFigure choice={avatar} size={44} />
    </IconButton>
  );
}

/**
 * 「現在地にもどる」ボタンだけ(案内画面など、LocationLayer を使わない画面向け)。
 * 使う側で <MapOverlay position="bottom-right"> の中に置いてください。
 */
export function LocateButton() {
  const { position, status } = useCurrentLocation();
  const flyToUser = useFlyToUser();
  return (
    <IconButton
      label="現在地にもどる"
      onClick={() => (position ? flyToUser(position) : retryLocation())}
      aria-busy={status === "locating" || undefined}
    >
      <LocateIcon size={30} />
    </IconButton>
  );
}
