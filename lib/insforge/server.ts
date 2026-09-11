import { cache } from "react";
import { createAdminClient } from "@insforge/sdk";

export const createInsForgeServerClient = cache(async () => {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Missing INSFORGE_API_KEY or NEXT_PUBLIC_INSFORGE_URL for server client.");
  }
  return createAdminClient({ apiKey, baseUrl });
});
