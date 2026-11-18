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
      if (animate) map.flyTo({ ...options, duration: 900 });
      else map.jumpTo(options);
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
  // 指で地図を動かしたら、勝手に戻らないようにやめる。
  const following = useRef(true);
  const centeredOnce = useRef(false);

  useEffect(() => {
    if (!map) return;
    const stopFollowing = () => {
      following.current = false;
    };
    map.on("dragstart", stopFollowing);
    return () => {
      map.off("dragstart", stopFollowing);
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
    map.easeTo({ center: toLngLatArray(location.position), duration: 600 });
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
      {card ? (
        // カードを出す間は、右下のボタンをカードの上に積んで重ならないようにする
        <MapOverlay position="bottom">
          {/* 小さい画面でもはみ出さないよう、カードの間は現在地ボタンだけにする */}
          <div className="flex flex-col items-end gap-3 self-end pr-1">{locateButton}</div>
          {card}
        </MapOverlay>
      ) : (
        <MapOverlay position="bottom-right">
          <AvatarButton />
          {locateButton}
        </MapOverlay>
      )}
    </>
  );
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
