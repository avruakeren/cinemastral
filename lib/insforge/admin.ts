import { createAdminClient } from "@insforge/sdk";

let _cached: ReturnType<typeof createAdminClient> | null = null;

export function createAdminServerClient() {
  if (_cached) return _cached;
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing INSFORGE_API_KEY or NEXT_PUBLIC_INSFORGE_URL for admin client.",
    );
  }
  _cached = createAdminClient({ apiKey, baseUrl });
  return _cached;
}
