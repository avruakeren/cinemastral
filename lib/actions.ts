"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthActions } from "@insforge/sdk/ssr";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { isValidUuid } from "@/lib/utils";

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    return { error: error?.message ?? "Gagal masuk" };
  }
  redirect("/");
}

export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signUp({
    email,
    password,
    name: email.split("@")[0],
  });
  if (error) return { error: error?.message ?? "Gagal mendaftar" };
  if (data?.requireEmailVerification) {
    return { requiresVerification: true };
  }
  redirect("/");
}

export async function signOut() {
  const auth = createAuthActions({ cookies: await cookies() });
  await auth.signOut();
  redirect("/");
}

export async function getCurrentUser() {
  const sb = await createInsForgeServerClient();
  const { data, error } = await sb.auth.getCurrentUser();
  return { user: error ? null : data?.user ?? null };
}

export async function getCurrentProfile() {
  const sb = await createInsForgeServerClient();
  const { data, error } = await sb.auth.getCurrentUser();
  if (error || !data?.user) return { user: null };
  const profile = await sb.database
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      username: profile.data?.username ?? null,
    },
  };
}

export async function toggleWatchlist(contentId: string) {
  const sb = await createInsForgeServerClient();
  const { data: { user }, error: authError } = await sb.auth.getCurrentUser();
  if (authError || !user) return { error: "AUTH_REQUIRED" };
  if (!isValidUuid(contentId)) return { error: "Invalid content id" };

  const existing = await sb.database
    .from("watchlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("content_id", contentId)
    .maybeSingle();

  if (existing.data) {
    const { error } = await sb.database.from("watchlist").delete().eq("id", existing.data.id);
    return { added: false, error: error?.message ?? null };
  }

  const { error } = await sb.database.from("watchlist").insert([
    { user_id: user.id, content_id: contentId, status: "planned" },
  ]);
  return { added: true, error: error?.message ?? null };
}

export async function saveProgress(input: {
  contentId: string;
  episodeId: string | null;
  progressSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}) {
  const sb = await createInsForgeServerClient();
  const { data: { user }, error: authError } = await sb.auth.getCurrentUser();
  if (authError || !user) return { error: "AUTH_REQUIRED" };
  if (!isValidUuid(input.contentId)) return { error: "Invalid content id" };

  const { contentId, episodeId, progressSeconds, durationSeconds, completed } = input;
  if (episodeId && !isValidUuid(episodeId)) return { error: "Invalid episode id" };
  const { error } = await sb.database
    .from("watch_progress")
    .upsert(
      [
        {
          user_id: user.id,
          content_id: contentId,
          episode_id: episodeId,
          progress_seconds: Math.round(progressSeconds),
          duration_seconds: durationSeconds ? Math.round(durationSeconds) : null,
          completed,
        },
      ],
      { onConflict: "user_id,content_id,episode_id" }
    );
  return { error: error?.message ?? null };
}

export async function initiateOAuth(provider: string, next?: string) {
  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.signInWithOAuth(provider, {
    redirectTo: new URL("/api/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString(),
    skipBrowserRedirect: true,
  });
  if (error || !data?.url || !data.codeVerifier) {
    return { error: error?.message ?? "OAuth init gagal" };
  }
  cookieStore.set("insforge_code_verifier", data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    cookieStore.set("insforge_oauth_next", next, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }
  redirect(data.url);
}
