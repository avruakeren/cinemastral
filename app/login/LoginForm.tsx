"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signInWithEmail, signUpWithEmail, initiateOAuth } from "@/lib/actions";

export function LoginForm({ mode, next }: { mode: "signin" | "signup"; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isSignup = mode === "signup";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = isSignup ? await signUpWithEmail(fd) : await signInWithEmail(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else if (res && "requiresVerification" in res && res.requiresVerification) {
        setNotice("Akun dibuat. Silakan cek email untuk verifikasi sebelum masuk.");
      } else {
        router.push(next || "/");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">Email</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="nama@email.com"
          className="w-full rounded-lg border border-white/15 bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[var(--color-primary)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-white/70">Password</label>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="••••••••"
          className="w-full rounded-lg border border-white/15 bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[var(--color-primary)]"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-purple-400/30 bg-purple-400/10 px-3 py-2 text-xs text-purple-300">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
      >
        {pending ? "Memproses…" : isSignup ? "Buat Akun" : "Masuk"}
      </button>

      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-white/40">atau</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await initiateOAuth("google", next);
            if (res?.error) {
              setError(res.error);
            }
          });
        }}
        className="login-google-btn"
      >
        <i className="fa-brands fa-google" />
        Lanjutkan dengan Google
      </button>
    </form>
  );
}
