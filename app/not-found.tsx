import Link from "next/link";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header
        links={[
          { href: "/", label: "Beranda", active: false },
          { href: "/film", label: "Film", active: false },
          { href: "/series", label: "Series", active: false },
          { href: "/anime", label: "Anime", active: false },
        ]}
      />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-6xl font-extrabold text-[var(--color-primary)]">404</p>
        <h1 className="text-xl font-bold text-white">Halaman tidak ditemukan</h1>
        <p className="max-w-sm text-sm text-white/50">
          Judul atau halaman yang kamu cari nggak ada. Mungkin udah dihapus atau salah ketik.
        </p>
        <Link
          href="/"
          className="mt-2 inline-block rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
        >
          Kembali ke Beranda
        </Link>
      </main>
    </>
  );
}
