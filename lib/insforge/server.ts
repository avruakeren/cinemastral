import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";

export const createInsForgeServerClient = cache(async () => {
  return createServerClient({
    cookies: await cookies(),
  });
});
