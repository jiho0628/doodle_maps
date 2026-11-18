"use client";

import { Button, Card, WarningIcon } from "@/components/ui";
import type { LocationStatus } from "./geolocationStore";

export type DevicePlatform = "ios" | "android" | "other";

export function detectPlatform(nav: { userAgent: string; maxTouchPoints?: number } | undefined): DevicePlatform {
  if (!nav) return "other";
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

const DENIED_STEPS: Record<DevicePlatform, string[]> = {
  ios: [
    "「設定」アプリをひらく",
    "「プライバシーとセキュリティ」→「位置情報サービス」",
    "「Safari の Web サイト」を「使用中のみ」にする",
  ],
  android: [
    "画面上の住所の左にある「鍵」や「◎」のマークを押す",
    "「権限」または「サイトの設定」をひらく",
    "「位置情報」を「許可」にする",
  ],
  other: ["ブラウザの住所欄の左にあるマークを押す", "「位置情報」を「許可」にする"],
};

type Content = { title: string; body: string; steps?: string[]; canRetry: boolean };

export function helpContent(status: LocationStatus, platform: DevicePlatform): Content | null {
  switch (status) {
    case "denied":
      return {
        title: "現在地が使えません",
        body: "位置情報が「許可しない」になっています。つぎの手順で許可すると、地図に「わたし」が出ます。",
        steps: DENIED_STEPS[platform],
        canRetry: true,
      };
    case "unavailable":
      return {
        title: "いまいる場所がわかりません",
        body: "空がひらけた場所で少し待ってから、もう一度ためしてください。スマホの「位置情報」がオフになっていないかも確かめてください。",
        canRetry: true,
      };
    case "unsupported":
      return {
        title: "この端末では現在地を使えません",
        body: "地図を動かして、行きたい場所をさがしてください。",
        canRetry: false,
      };
    default:
      return null;
  }
}

/** 位置情報が使えないときの、やさしい案内カード */
export function LocationHelpCard({
  status,
  platform,
  onRetry,
  onClose,
}: {
  status: LocationStatus;
  platform: DevicePlatform;
  onRetry: () => void;
  onClose: () => void;
}) {
  const content = helpContent(status, platform);
  if (!content) return null;

  return (
    <Card elevated role="alert" className="flex animate-rise-in flex-col gap-3.5 px-5 py-5">
      <div className="flex items-center gap-3">
        <span className="flex-none text-primary">
          <WarningIcon size={32} />
        </span>
        <p className="m-0 text-xl font-bold leading-snug">{content.title}</p>
      </div>
      <p className="m-0 text-base leading-relaxed text-ink-soft">{content.body}</p>
      {content.steps ? (
        <ol className="m-0 flex list-none flex-col gap-2 rounded-2xl bg-surface p-3.5">
          {content.steps.map((step, i) => (
            <li key={step} className="flex items-start gap-2.5 text-base leading-snug">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-primary-soft text-[15px] font-bold text-primary-strong">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-col gap-2.5">
        {content.canRetry ? (
          <Button block onClick={onRetry}>
            もう一度ためす
          </Button>
        ) : null}
        <Button block variant="soft" onClick={onClose}>
          とじる
        </Button>
      </div>
    </Card>
  );
}
