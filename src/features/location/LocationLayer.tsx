"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { IconButton, LocateIcon, cn } from "@/components/ui";
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

  // ほかの機能(お気に入りのカードなど)が下にカードを出している間は、こちらのカードは控える
  const [otherBottomCard, setOtherBottomCard] = useState(false);
  // 下のカードが高くて右下のボタンが上の検索バーまで届いてしまうときは、ボタンを隠す
  const [buttonsFit, setButtonsFit] = useState(true);
  const card = otherBottomCard ? null : showHelp ? (
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
      <MapOverlay position="bottom-right" className={buttonsFit ? undefined : "invisible"}>
        {/* 小さい画面でもはみ出さないよう、自分のカードを出す間は現在地ボタンだけにする */}
        {card ? null : <AvatarButton />}
        {locateButton}
        <BottomOverlaySpacer onOtherCardChange={setOtherBottomCard} onFitChange={setButtonsFit} />
      </MapOverlay>
      {card ? (
        <MapOverlay position="bottom" className={cn(OWN_CARD_CLASS, CARD_FIT_CLASS)}>
          {card}
        </MapOverlay>
      ) : null}
    </>
  );
}

/**
 * 右下のボタンが、下部のカード(この機能の案内、お気に入りのカードなど、どの機能のものでも)に
 * 重ならないよう、下部に出ているものの高さぶんだけ持ち上げる。
 * 持ち上げた結果、上部(検索バーなど)に重なるときは onFitChange(false) で知らせる。
 */
const OWN_CARD_CLASS = "location-card-overlay";

/**
 * 小さい画面でカードが上の検索バー(高さ 68px+上の余白)に重ならないよう、高さを抑えて中をスクロールさせる。
 * 84px = 検索バー 68px + すき間 16px
 */
const CARD_FIT_CLASS =
  "max-h-[calc(100%_-_max(20px,env(safe-area-inset-top))_-_84px)] [&>*]:min-h-0 [&>*]:overflow-y-auto";

function BottomOverlaySpacer({
  onOtherCardChange,
  onFitChange,
}: {
  onOtherCardChange: (present: boolean) => void;
  onFitChange: (fits: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const column = ref.current?.closest<HTMLElement>("[data-map-overlay]");
    const root = column?.parentElement;
    if (!column || !root || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      let h = 0;
      const overlays = root.querySelectorAll<HTMLElement>(':scope > [data-map-overlay="bottom"]');
      onOtherCardChange(Array.from(overlays).some((el) => !el.classList.contains(OWN_CARD_CLASS) && el.offsetHeight > 0));
      overlays.forEach((el) => {
        // MapOverlay の下の余白(pb-4)はボタン側にもあるので差し引く
        const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
        h = Math.max(h, el.offsetHeight > pad ? el.offsetHeight - pad : 0);
      });
      setHeight(h);
      // 右下のボタンのいちばん上が、上部の部品の下端より上に来たら「入りきらない」
      const top = root.querySelector<HTMLElement>(':scope > [data-map-overlay="top"]');
      const firstButton = Array.from(column.children).find((el) => el !== ref.current);
      onFitChange(
        !top || !firstButton || firstButton.getBoundingClientRect().top >= top.getBoundingClientRect().bottom + 8,
      );
    };
    const resize = new ResizeObserver(measure);
    const observeAll = () => {
      resize.disconnect();
      resize.observe(root);
      resize.observe(column);
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
  }, [onOtherCardChange, onFitChange]);

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
