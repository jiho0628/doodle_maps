/** オリジナル動物アバター(既存キャラクターは使わない) */
export type AnimalAvatarId = "rabbit" | "bear" | "cat" | "chick" | "penguin";

export type AvatarChoice =
  | { kind: "animal"; animal: AnimalAvatarId }
  /** 端末内だけに保存する写真(縮小済みの data URL) */
  | { kind: "photo"; dataUrl: string };

export const DEFAULT_AVATAR: AvatarChoice = { kind: "animal", animal: "rabbit" };
