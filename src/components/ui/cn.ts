/** className を空白区切りでつなぐ(falsy は無視) */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
