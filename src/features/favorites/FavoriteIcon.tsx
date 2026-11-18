import type { SVGProps } from "react";
import { HeartIcon, HomeIcon, cn } from "@/components/ui";
import type { FavoriteIcon as FavoriteIconId } from "@/types";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Svg({ size = 30, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}

function SchoolIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c3 2 9 2 12 0v-5" />
    </Svg>
  );
}

function CafeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M16 11h2a2 2 0 0 1 0 4h-2" />
    </Svg>
  );
}

function ShopIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </Svg>
  );
}

/** アイコンごとの色(デザインのカテゴリ色) */
const TONES: Record<FavoriteIconId, string> = {
  home: "bg-primary-soft text-primary-strong",
  school: "bg-sky-soft text-sky",
  cafe: "bg-honey-soft text-honey",
  shop: "bg-leaf-soft text-leaf",
  heart: "bg-primary-soft text-primary-strong",
};

export function FavoriteGlyph({ icon, size = 30 }: { icon: FavoriteIconId; size?: number }) {
  switch (icon) {
    case "home":
      return <HomeIcon size={size} />;
    case "school":
      return <SchoolIcon size={size} />;
    case "cafe":
      return <CafeIcon size={size} />;
    case "shop":
      return <ShopIcon size={size} />;
    default:
      return <HeartIcon size={size} filled />;
  }
}

/** 一覧の左に出す角丸の色つきアイコン */
export function FavoriteBadge({ icon, className, size = 56 }: { icon: FavoriteIconId; className?: string; size?: 56 | 44 }) {
  return (
    <span
      className={cn(
        "flex flex-none items-center justify-center",
        size === 56 ? "size-14 rounded-[18px]" : "size-11 rounded-[14px]",
        TONES[icon],
        className,
      )}
    >
      <FavoriteGlyph icon={icon} size={size === 56 ? 30 : 24} />
    </span>
  );
}

export function iconToneClass(icon: FavoriteIconId): string {
  return TONES[icon];
}
