"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { HeaderShell } from "./HeaderShell";

export type HeaderLink = {
  href: string;
  label: string;
  active: boolean;
};

const NAV_ICONS: Record<string, string> = {
  "/": "fa-house",
  "/film": "fa-film",
  "/series": "fa-tv",
  "/anime": "fa-dragon",
};

interface HeaderUser {
  id?: string;
  email?: string | null;
  username?: string | null;
}

export function Header({ links, user }: { links?: HeaderLink[]; user?: HeaderUser | null }) {
  return (
    <HeaderShell>
      <div className="flex items-center h-12 sm:h-14">
        <Link href="/" className="logo-mark">
          <img src="/logo.png" alt="Cinemastral" width={400} height={225} className="h-[50px] sm:h-[60px] w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 ml-auto rounded-full bg-black/40 border border-white/15 px-1 py-1 backdrop-blur-md">
          {links?.map((l) => {
            const icon = NAV_ICONS[l.href];
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={l.active ? "page" : undefined}
                className={cn("hero-nav-link", l.active && "is-active")}
              >
                {icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
                {l.label}
              </Link>
            );
          })}
          <Link href="/search" className="hero-nav-icon-btn" aria-label="Search">
            <i className="fa-solid fa-magnifying-glass" />
          </Link>
          {user ? (
            <Link href="/watchlist" className="hero-nav-icon-btn" aria-label="My List">
              <i className="fa-solid fa-bookmark" />
            </Link>
          ) : (
            <Link href="/login" className="hero-nav-icon-btn" aria-label="Login">
              <i className="fa-solid fa-bell" />
            </Link>
          )}
        </nav>

      </div>
    </HeaderShell>
  );
}
