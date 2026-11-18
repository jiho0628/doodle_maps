import type { AnimalAvatarId, AvatarChoice } from "@/types/avatar";

/** えらべる動物(すべてオリジナル。既存キャラクターは使わない) */
export const ANIMAL_AVATARS: readonly { id: AnimalAvatarId; label: string }[] = [
  { id: "rabbit", label: "うさぎ" },
  { id: "bear", label: "くま" },
  { id: "cat", label: "ねこ" },
  { id: "chick", label: "ひよこ" },
  { id: "penguin", label: "ペンギン" },
];

const ANIMAL_IDS = new Set<string>(ANIMAL_AVATARS.map((a) => a.id));

export function isAnimalAvatarId(value: unknown): value is AnimalAvatarId {
  return typeof value === "string" && ANIMAL_IDS.has(value);
}

/** localStorage から読んだ値が AvatarChoice の形か確かめる */
export function isAvatarChoice(value: unknown): value is AvatarChoice {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.kind === "animal") return isAnimalAvatarId(v.animal);
  if (v.kind === "photo") return typeof v.dataUrl === "string" && v.dataUrl.startsWith("data:image/");
  return false;
}

/** 読み上げ・表示用の名前(「うさぎ」「写真」) */
export function avatarLabel(choice: AvatarChoice): string {
  if (choice.kind === "photo") return "写真";
  return ANIMAL_AVATARS.find((a) => a.id === choice.animal)?.label ?? "どうぶつ";
}

export function isSameAvatar(a: AvatarChoice, b: AvatarChoice): boolean {
  if (a.kind === "animal" && b.kind === "animal") return a.animal === b.animal;
  if (a.kind === "photo" && b.kind === "photo") return a.dataUrl === b.dataUrl;
  return false;
}
