"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, ButtonLink, Card, IconButton, LocateIcon, WarningIcon } from "@/components/ui";
import { retryLocation, UserLocationMarker, useCurrentLocation, type LocationStatus } from "@/features/location";
import { MapView } from "@/features/map";
import type { Place } from "@/types";
import { formatClock, formatDistance, formatMinutes } from "./geo";
import { parseNavigateParams } from "./navigateHref";
import { RouteMapLayer } from "./RouteMapLayer";
import { TurnIcon } from "./TurnIcon";
import { turnLabel } from "./turns";
import { useNavigation, type NavigationError, type NavigationView } from "./useNavigation";
import { useWakeLock } from "./useWakeLock";

/** 経路の全体を見せてから、現在地についていくまでの時間 */
const OVERVIEW_MS = 3_500;

/** /navigate?lng=&lat=&name= の画面。URL から目的地を読む */
export function NavigateScreen() {
  const params = useSearchParams();
  const destination = parseNavigateParams(params);
  if (!destination) return <InvalidDestination />;
  return <Navigation destination={destination} />;
}

function Navigation({ destination }: { destination: Place }) {
  const [attempt, setAttempt] = useState(0);
  const location = useCurrentLocation();
  const nav = useNavigation(destination, location.position, attempt);
  const [follow, setFollow] = useState(false);

  const navigating = nav.phase.kind === "navigating";
  useWakeLock(navigating);

  // 経路の全体を少し見せてから、現在地についていく
  const hasRoute = nav.route !== null;
  useEffect(() => {
    if (!hasRoute) return;
    const t = setTimeout(() => setFollow(true), OVERVIEW_MS);
    return () => clearTimeout(t);
  }, [hasRoute]);

  const positionStatus = location.position ? "ok" : location.status;
  // 表示する内容が切りかわったときだけ、シートの中身をふわっと出しなおす
  const sheetKey = isPositionProblem(positionStatus) ? "position-problem" : nav.phase.kind;

  const retry = () => {
    setFollow(false);
    retryLocation();
    setAttempt((n) => n + 1);
  };

  return (
    <div className="relative h-dvh overflow-hidden">
      <MapView>
        <RouteMapLayer
          destination={destination}
          coordinates={nav.route?.route.coordinates ?? null}
          position={location.position}
          follow={follow && navigating}
          onUserMove={() => setFollow(false)}
        />
        <UserLocationMarker />
        {navigating ? <TurnBanner nav={nav} /> : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-3 [&>*]:pointer-events-auto">
          {navigating && !follow ? (
            <IconButton label="現在地にもどる" className="mr-5 animate-fade-in" onClick={() => setFollow(true)}>
              <LocateIcon size={30} />
            </IconButton>
          ) : null}
          <BottomSheet contentKey={sheetKey}>
            <SheetContent destination={destination} nav={nav} positionStatus={positionStatus} onRetry={retry} />
          </BottomSheet>
        </div>
      </MapView>
    </div>
  );
}

function isPositionProblem(status: PositionStatus): boolean {
  return status === "denied" || status === "unsupported" || status === "unavailable";
}

function BottomSheet({ contentKey, children }: { contentKey: string; children: React.ReactNode }) {
  return (
    <section
      aria-label="道案内"
      className="w-full animate-sheet-up rounded-t-[32px] bg-card px-[22px] pt-6 shadow-float"
      style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
    >
      <div key={contentKey} className="flex animate-fade-in flex-col gap-4">
        {children}
      </div>
    </section>
  );
}

/** 画面上部の「120m 先 / 右へ曲がる」 */
function TurnBanner({ nav }: { nav: NavigationView }) {
  const step = nav.nextStep;
  const approximate = nav.route?.approximate ?? false;
  const arriving = step?.turn === "arrive";
  // 曲がる地点ごとに変わる(同じ「右へ」が続いても、次の曲がり角になれば弾む)
  const turnKey = approximate
    ? "approximate"
    : `${step?.turn ?? "none"}@${step?.position?.lng ?? ""},${step?.position?.lat ?? ""}`;
  return (
    <div
      className="absolute inset-x-4 top-0 z-10 animate-fade-in"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
    >
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-[18px] rounded-[28px] bg-primary px-[22px] py-[18px] text-white shadow-float"
      >
        {/* 曲がり方が変わったら、アイコンを小さく弾ませて気づけるようにする */}
        <div
          key={turnKey}
          className="flex size-[72px] flex-none animate-pop items-center justify-center rounded-[22px] bg-card text-primary"
        >
          <TurnIcon turn={approximate ? "straight" : step?.turn} />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          {nav.distanceToNextM !== null ? (
            <div className="text-[30px] font-black leading-tight">{formatDistance(nav.distanceToNextM)} 先</div>
          ) : null}
          <div className="text-[22px] font-bold leading-snug">
            {approximate ? "目的地の方へ進む" : arriving ? "目的地に到着" : turnLabel(step?.turn)}
          </div>
        </div>
      </div>
    </div>
  );
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function SheetContent({
  destination,
  nav,
  positionStatus,
  onRetry,
}: {
  destination: Place;
  nav: NavigationView;
  positionStatus: LocationStatus;
  onRetry: () => void;
}) {
  const now = useNow(30_000);
  const quit = (
    <ButtonLink href="/" variant="soft" size="lg" block>
      案内をおわる
    </ButtonLink>
  );

  // 位置がわからない
  if (isPositionProblem(positionStatus)) {
    const text =
      positionStatus === "denied"
        ? "いまいる場所を使うことが許可されていません。ブラウザの設定で「位置情報」を許可してから、もう一度ためしてください。"
        : positionStatus === "unsupported"
          ? "この端末では、いまいる場所を調べられません。"
          : "いまいる場所がわかりませんでした。空が見える場所で、もう一度ためしてください。";
    return (
      <Problem title="いまいる場所がわかりません" text={text} onRetry={positionStatus === "unsupported" ? undefined : onRetry} />
    );
  }

  switch (nav.phase.kind) {
    case "locating":
      return <Waiting title="いまいる場所をさがしています…" destination={destination} action={quit} />;
    case "routing":
      return <Waiting title="道を調べています…" destination={destination} action={quit} />;
    case "failed":
      return <Problem title="道案内できません" text={errorText(nav.phase.error)} onRetry={nav.phase.error === "error" ? onRetry : undefined} />;
    case "arrived":
      return (
        <>
          <div className="flex flex-col gap-1">
            <p className="m-0 text-[34px] font-black leading-tight">着きました！</p>
            <p className="m-0 text-lg text-ink-soft">{destination.name}</p>
          </div>
          <ButtonLink href="/" size="lg" block>
            地図にもどる
          </ButtonLink>
        </>
      );
    case "navigating": {
      const minutes = (nav.remainingS ?? 0) / 60;
      const arrival = new Date(now + (nav.remainingS ?? 0) * 1000);
      return (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="m-0 text-[34px] font-black leading-tight">あと {formatMinutes(minutes)}</p>
            <p className="m-0 text-lg text-ink-soft">
              {formatDistance(nav.remainingM ?? 0)} ・ {formatClock(arrival)} 着
            </p>
          </div>
          <p className="m-0 text-[17px] text-ink-soft">
            {destination.name} まで歩いて案内中{nav.rerouting ? "(道を調べなおしています)" : ""}
          </p>
          {nav.route?.approximate ? (
            <p className="m-0 animate-rise-in rounded-2xl bg-honey-soft px-4 py-3 text-base leading-relaxed text-honey">
              いまは道順を調べられないため、目的地の方向を線で示しています。
            </p>
          ) : null}
          {quit}
        </>
      );
    }
  }
}

function errorText(error: NavigationError): string {
  switch (error) {
    case "too_far":
      return "目的地が遠すぎるため、歩いての道案内ができません。";
    case "no_route":
      return "目的地までの歩ける道が見つかりませんでした。";
    case "error":
      return "通信がうまくいきませんでした。電波のよい場所で、もう一度ためしてください。";
  }
}

function Waiting({ title, destination, action }: { title: string; destination: Place; action: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col gap-1" role="status">
        <p className="m-0 text-2xl font-black leading-snug">{title}</p>
        <p className="m-0 text-[17px] text-ink-soft">行き先: {destination.name}</p>
      </div>
      {action}
    </>
  );
}

function Problem({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-4" role="alert">
      <div className="flex items-center gap-3">
        <span className="text-primary">
          <WarningIcon size={32} />
        </span>
        <p className="m-0 text-2xl font-black leading-snug">{title}</p>
      </div>
      <p className="m-0 text-lg leading-relaxed text-ink-soft">{text}</p>
      {onRetry ? (
        <Button size="lg" block onClick={onRetry}>
          もう一度ためす
        </Button>
      ) : null}
      <ButtonLink href="/" variant="soft" size="lg" block>
        地図にもどる
      </ButtonLink>
    </div>
  );
}

function InvalidDestination() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-5">
      <Card className="flex w-full max-w-sm flex-col gap-4 p-6" role="alert">
        <p className="m-0 text-xl font-bold">行き先がわかりませんでした</p>
        <p className="m-0 text-base leading-relaxed text-ink-soft">もう一度、場所をさがしてから「行く」を押してください。</p>
        <ButtonLink href="/search" block>
          場所をさがす
        </ButtonLink>
        <ButtonLink href="/" variant="soft" block>
          地図にもどる
        </ButtonLink>
      </Card>
    </div>
  );
}
