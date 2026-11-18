"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, cn } from "@/components/ui";
import type { FavoriteIcon } from "@/types";
import { FavoriteGlyph, iconToneClass } from "./FavoriteIcon";
import { FAVORITE_ICON_LABELS, FAVORITE_ICONS, FAVORITE_NAME_MAX } from "./model";

/** 名前とアイコンを決める入力欄(追加・変更で共通) */
export function FavoriteForm({
  initialName = "",
  initialIcon = "heart",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  initialIcon?: FavoriteIcon;
  submitLabel: string;
  onSubmit: (value: { name: string; icon: FavoriteIcon }) => void;
  onCancel: () => void;
}) {
  const nameId = useId();
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<FavoriteIcon>(initialIcon);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name, icon });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-lg font-bold">
          名前
        </label>
        <input
          id={nameId}
          data-autofocus
          type="text"
          value={name}
          maxLength={FAVORITE_NAME_MAX}
          placeholder="例:おうち"
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          className="h-16 w-full rounded-2xl border-[2.5px] border-line bg-card px-4 text-xl font-bold text-ink placeholder:text-ink-soft/70 focus:border-primary focus:outline-none"
        />
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-lg font-bold">しるし</legend>
        <div className="grid grid-cols-5 gap-2">
          {FAVORITE_ICONS.map((id) => {
            const selected = id === icon;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setIcon(id)}
                className={cn(
                  "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border-[3px] bg-card px-1 text-sm font-bold text-ink",
                  selected ? "border-primary" : "border-transparent shadow-card",
                )}
              >
                <span className={cn("flex size-10 items-center justify-center rounded-xl", iconToneClass(id))}>
                  <FavoriteGlyph icon={id} size={24} />
                </span>
                {FAVORITE_ICON_LABELS[id]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" block>
          {submitLabel}
        </Button>
        <Button variant="white" block onClick={onCancel}>
          やめる
        </Button>
      </div>
    </form>
  );
}
