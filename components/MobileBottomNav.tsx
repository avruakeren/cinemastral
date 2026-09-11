"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ITEMS = [
  { href: "/", icon: "fa-house", label: "Home" },
  { href: "/film", icon: "fa-film", label: "Movies" },
  { href: "/series", icon: "fa-tv", label: "Shows" },
  { href: "/watchlist", icon: "fa-bookmark", label: "My List" },
  { href: "/search", icon: "fa-magnifying-glass", label: "Search" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav md:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn("mobile-bottom-nav-item", isActive && "is-active")}
            aria-label={item.label}
          >
            <i className={`fa-solid ${item.icon}`} />
          </Link>
        );
      })}
    </nav>
  );
}
