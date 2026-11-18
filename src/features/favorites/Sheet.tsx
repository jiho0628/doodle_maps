"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * 画面下からせり出す入れ物(名前を変える・消す確認など)。
 * 背景を押す・Esc キーで閉じます。開いたら最初の入力欄かボタンにフォーカスします。
 */
export function Sheet({
  title,
  onClose,
  children,
  role = "dialog",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** 消す確認など、答えが必要なものは alertdialog */
  role?: "dialog" | "alertdialog";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>("input, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div aria-hidden="true" className="absolute inset-0 animate-fade-in bg-ink/45" onClick={onClose} data-testid="sheet-backdrop" />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full max-w-lg animate-sheet-up flex-col gap-5 overflow-y-auto rounded-t-[32px] bg-surface px-5 pt-6 shadow-float"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        <h2 id={titleId} className="m-0 text-2xl font-black leading-snug">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
