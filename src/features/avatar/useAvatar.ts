"use client";

import { STORAGE_KEYS, useStoredState } from "@/lib/storage";
import { DEFAULT_AVATAR, type AvatarChoice } from "@/types/avatar";
import { isAvatarChoice } from "./avatars";

/**
 * 保存しているアバターと、保存する関数。
 * 保存できなかった(容量オーバーなど)ときは setter が false を返します。
 * サーバー描画と最初の描画では DEFAULT_AVATAR(うさぎ)を返します。
 */
export function useAvatar(): [AvatarChoice, (choice: AvatarChoice) => boolean] {
  const [avatar, setAvatar] = useStoredState(STORAGE_KEYS.avatar, DEFAULT_AVATAR, isAvatarChoice);
  return [avatar, setAvatar as (choice: AvatarChoice) => boolean];
}
