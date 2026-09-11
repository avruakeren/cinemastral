"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions";
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <HeaderShell>
      <div className="flex items-center h-14 sm:h-16 gap-6">
        <Link href="/" className="logo-mark" onClick={() => setMenuOpen(false)}>
          <img src="/logo.png" alt="Cinemastral" width={400} height={225} className="h-7 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
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
        </nav>

        <div className="ml-auto flex items-center gap-2">
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
          <button
            className="hero-nav-icon-btn md:hidden"
            aria-label={menuOpen ? "Close menu" : "Menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"}`} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="mobile-nav md:hidden" onClick={() => setMenuOpen(false)}>
          {links?.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={cn("mobile-nav-link", l.active && "active")}
            >
              {l.label}
            </Link>
          ))}
          {user && (
            <form action={signOut}>
              <button className="mobile-nav-link w-full text-left" type="submit">
                Sign Out
              </button>
            </form>
          )}
        </nav>
      )}
    </HeaderShell>
  );
}
