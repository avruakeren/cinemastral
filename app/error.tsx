"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <i className="fa-solid fa-face-frown text-5xl text-white/25" />
      <h1 className="text-xl font-bold text-white">Terjadi kesalahan</h1>
      <p className="max-w-sm text-sm text-white/50">
        Maaf, ada yang tidak beres saat memuat halaman ini.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
        >
          Coba Lagi
        </button>
        <Link
          href="/"
          className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          Ke Beranda
        </Link>
      </div>
    </main>
  );
}
