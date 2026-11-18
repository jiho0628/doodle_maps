"use client";

import { Button, Card, CompassIcon } from "@/components/ui";

/**
 * iPhone で、向きを出すための許可をやさしくお願いするカード(初回だけ)。
 * 「はい、出す」のタップの中で許可ダイアログを出す必要がある。
 */
export function CompassPromptCard({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <Card elevated className="flex flex-col gap-3.5 px-5 py-5" role="dialog" aria-labelledby="compass-prompt-title">
      <div className="flex items-center gap-3">
        <span className="flex-none text-primary">
          <CompassIcon size={34} />
        </span>
        <p id="compass-prompt-title" className="m-0 text-[19px] font-bold leading-snug">
          向いている方向も
          <br />
          地図に出しますか？
        </p>
      </div>
      <p className="m-0 text-base leading-relaxed text-ink-soft">
        次の画面で「許可」を押すと、アバターの前に向きが出ます。
      </p>
      <div className="flex flex-col gap-2.5">
        <Button block onClick={onAccept}>
          はい、出す
        </Button>
        <Button block variant="soft" onClick={onDecline}>
          いまは出さない
        </Button>
      </div>
    </Card>
  );
}
