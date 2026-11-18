import type { RouteTurn } from "@/types";

/** 曲がり方の矢印(案内中の大きなバナー用)。色は currentColor */
const PATHS: Record<RouteTurn, string[]> = {
  depart: ["M12 20V5", "M7 10l5-5 5 5"],
  straight: ["M12 20V5", "M7 10l5-5 5 5"],
  right: ["M7 20V11a3 3 0 0 1 3-3h9", "M15 4l4 4-4 4"],
  left: ["M17 20V11a3 3 0 0 0-3-3H5", "M9 4L5 8l4 4"],
  "slight-right": ["M8 20v-6l8-8", "M11 6h5v5"],
  "slight-left": ["M16 20v-6L8 6", "M13 6H8v5"],
  "sharp-right": ["M7 4v9a3 3 0 0 0 3 3h8", "M14 12l4 4-4 4"],
  "sharp-left": ["M17 4v9a3 3 0 0 1-3 3H6", "M10 12l-4 4 4 4"],
  "keep-right": ["M9 20V8", "M9 12l7-6", "M12 6h4v4"],
  "keep-left": ["M15 20V8", "M15 12L8 6", "M12 6H8v4"],
  "u-turn": ["M8 20V9a4 4 0 0 1 8 0v4", "M12 10l4 4 4-4"],
  roundabout: ["M12 20v-5", "M12 15a4 4 0 1 0-4-4", "M5 8l3 3 3-3"],
  arrive: [
    "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z",
    "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  ],
};

export function TurnIcon({ turn, size = 46 }: { turn: RouteTurn | undefined; size?: number }) {
  const paths = PATHS[turn ?? "straight"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-turn={turn ?? "straight"}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
