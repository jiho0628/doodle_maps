import { Button, Card, WarningIcon } from "@/components/ui";
import type { MapStatus } from "./MapContext";

/** 地図の読みこみ中・失敗時に出す案内 */
export function MapStatusOverlay({ status, onRetry }: { status: MapStatus; onRetry: () => void }) {
  if (status === "ready") return null;

  if (status === "loading") {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
        <span className="rounded-full bg-card/90 px-6 py-3 text-lg font-bold text-ink-soft shadow-card">
          地図を読みこみ中…
        </span>
      </div>
    );
  }

  const unsupported = status === "unsupported";
  return (
    <div className="absolute inset-0 flex items-center justify-center px-5" role="alert">
      <Card elevated className="flex w-full max-w-sm flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <span className="text-primary">
            <WarningIcon size={32} />
          </span>
          <p className="m-0 text-xl font-bold leading-snug">
            {unsupported ? "この端末では地図を表示できません" : "地図を読みこめません"}
          </p>
        </div>
        <p className="m-0 text-base leading-relaxed text-ink-soft">
          {unsupported
            ? "ブラウザを新しくするか、別のブラウザでためしてください。"
            : "電波のよい場所で、もう一度ためしてください。"}
        </p>
        {unsupported ? null : (
          <Button block onClick={onRetry}>
            もう一度ためす
          </Button>
        )}
      </Card>
    </div>
  );
}
