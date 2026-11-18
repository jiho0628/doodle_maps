import type { ReactNode } from "react";

/** 画面上部の大きな見出し(「お気に入り」など) */
export function ScreenHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="m-0 text-[30px] font-black leading-tight">{title}</h1>
      {description ? <p className="m-0 text-base text-ink-soft">{description}</p> : null}
    </header>
  );
}
