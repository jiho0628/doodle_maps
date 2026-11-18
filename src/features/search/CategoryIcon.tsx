import type { SearchCategory } from "./categories";

const PATHS: Record<SearchCategory["id"], string[]> = {
  cafe: ["M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z", "M16 11h2a2 2 0 0 1 0 4h-2"],
  convenience: ["M4 10l2-5h12l2 5", "M5 10v9h14v-9", "M10 19v-5h4v5"],
  station: ["M6 6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z", "M6 11h12M9 21l1-4M15 21l-1-4"],
  toilet: ["M8 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", "M16 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", "M8 9v12M16 9l-3 7h6z"],
};

/** カテゴリごとの色(A案のアクセント) */
export const CATEGORY_TONE: Record<SearchCategory["id"], { bg: string; fg: string }> = {
  cafe: { bg: "bg-primary-soft", fg: "text-primary-strong" },
  convenience: { bg: "bg-leaf-soft", fg: "text-leaf" },
  station: { bg: "bg-sky-soft", fg: "text-sky" },
  toilet: { bg: "bg-honey-soft", fg: "text-honey" },
};

export function CategoryIcon({ id, size = 28 }: { id: SearchCategory["id"]; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
