"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartIcon, MapIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

/**
 * 画面下のタブ。迷わないよう「地図」「お気に入り」の2つだけにしています。
 * タブを増やす場合はデザインの合意を取ってから。
 */
export const TABS = [
  { href: "/", label: "地図", icon: "map" },
  { href: "/favorites", label: "お気に入り", icon: "heart" },
] as const;

export function isTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomTabBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="メインメニュー"
      className="flex-none border-t border-line bg-surface px-4 pt-2"
      style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
    >
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
        {TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[68px] items-center justify-center gap-2 rounded-[22px] text-lg font-bold no-underline",
                  "transition-[transform,background-color,color] duration-200 active:scale-[0.97]",
                  active ? "bg-primary-soft text-primary-strong" : "text-ink-soft",
                )}
              >
                {tab.icon === "map" ? <MapIcon /> : <HeartIcon filled={active} />}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
