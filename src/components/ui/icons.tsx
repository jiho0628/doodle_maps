import type { SVGProps } from "react";

/**
 * A案で使う線アイコン。色は currentColor、太さは stroke-width で調整。
 * 飾りなので aria-hidden。意味が必要なときはボタン側に aria-label を付けること。
 */
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Svg({ size = 26, strokeWidth = 2.2, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </Svg>
  );
}

export function LocateIcon(p: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  );
}

export function MapIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </Svg>
  );
}

export function HeartIcon({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg fill={filled ? "currentColor" : "none"} {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </Svg>
  );
}

export function BackIcon(p: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg strokeWidth={2.6} {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 11l8-7 8 7v9H4z" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  );
}

export function CompassIcon(p: IconProps) {
  return (
    <Svg strokeWidth={2} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-2 4-4 2 2-4z" />
    </Svg>
  );
}

export function TurnRightIcon(p: IconProps) {
  return (
    <Svg strokeWidth={2.8} {...p}>
      <path d="M7 20V11a3 3 0 0 1 3-3h9" />
      <path d="M15 4l4 4-4 4" />
    </Svg>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function WarningIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4M12 17.5v.01" />
    </Svg>
  );
}
