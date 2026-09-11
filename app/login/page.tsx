import { Header } from "@/components/Header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; next?: string }>;
}) {
  const { mode, error, next } = await searchParams;
  const isSignup = mode === "signup";
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  const sb = await createInsForgeServerClient();
  const { data } = await sb.auth.getCurrentUser();
  if (data?.user) redirect("/");

  const errorMsg = error === "oauth_failed"
    ? "Login OAuth gagal."
    : error === "exchange_failed"
      ? "Kode OAuth tidak valid."
      : error === "missing_verifier"
        ? "Sesi verifikasi tidak ditemukan. Coba lagi."
        : null;

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
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--color-surface)] p-8">
          <div className="mb-6 text-center">
            <i className="fa-solid fa-user-astronaut mb-3 text-5xl text-[var(--color-primary)]" />
            <h1 className="text-2xl font-extrabold">{isSignup ? "Daftar" : "Masuk"}</h1>
            <p className="mt-1 text-sm text-white/60">
              {isSignup
                ? "Buat akun untuk watchlist & progres tonton"
                : "Lanjutkan sesi & sinkronkan progress"}
            </p>
          </div>

          {errorMsg && (
            <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {errorMsg}
            </p>
          )}

          <LoginForm mode={isSignup ? "signup" : "signin"} next={safeNext} />

          <p className="mt-6 text-center text-sm text-white/60">
            {isSignup ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
            <Link
              href={isSignup ? "/login" : "/login?mode=signup"}
              className="font-semibold text-[var(--color-primary)] hover:underline"
            >
              {isSignup ? "Masuk" : "Daftar"}
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
