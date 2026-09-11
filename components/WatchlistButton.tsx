"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleWatchlist } from "@/lib/actions";

export function WatchlistButton({ contentId, initialInList }: { contentId: string; initialInList: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [inList, setInList] = useState(initialInList);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState(false);

  function onClick() {
    setError(false);
    startTransition(async () => {
      const res = await toggleWatchlist(contentId);
      if (res?.error === "AUTH_REQUIRED") {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (res?.error) {
        setError(true);
        return;
      }
      setInList(res?.added ?? false);
      setFlash(true);
      setTimeout(() => setFlash(false), 2000);
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
    >
      <i className={`fa-solid fa-bookmark ${inList ? "text-[var(--color-primary)]" : ""}`} />
      {inList ? "Di Daftar Tonton" : "Daftar Tonton"}
      {flash && (
        <span className="text-xs text-[var(--color-primary)]">
          {inList ? "Ditambahkan!" : "Dihapus!"}
        </span>
      )}
      {error && <span className="text-xs text-red-400">(gagal)</span>}
    </button>
  );
}
