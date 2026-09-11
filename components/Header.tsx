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
      <div className="flex items-center h-14 sm:h-16 gap-4">
        <Link href="/" className="logo-mark" onClick={() => setMenuOpen(false)}>
          <img src="/logo.png" alt="Cinemastral" width={400} height={225} className="h-7 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0">
          {links?.map((l) => {
            const icon = NAV_ICONS[l.href];
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={l.active ? "page" : undefined}
                className={cn("header-nav-link", l.active && "active")}
              >
                {icon && <i className={`fa-solid ${icon} header-nav-icon`} aria-hidden="true" />}
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link href="/search" className="header-action-btn" aria-label="Cari">
            <i className="fa-solid fa-magnifying-glass text-sm" />
          </Link>
          <Link href="/watchlist" className="header-action-btn hidden sm:flex" aria-label="Daftar tonton">
            <i className="fa-solid fa-bookmark text-sm" />
          </Link>
          {user ? (
            <>
              <Link href="/watchlist" className="header-avatar" title={user.email ?? ""}>
                {(user.username ?? user.email ?? "U").slice(0, 2).toUpperCase()}
              </Link>
              <form action={signOut}>
                <button className="header-action-btn" type="submit" aria-label="Keluar">
                  <i className="fa-solid fa-right-from-bracket text-sm" />
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="header-action-btn" aria-label="Masuk">
              <i className="fa-solid fa-user text-sm" />
            </Link>
          )}
          <button
            className="header-action-btn md:hidden"
            aria-label={menuOpen ? "Tutup menu" : "Menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"} text-sm`} />
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
        </nav>
      )}
    </HeaderShell>
  );
}
