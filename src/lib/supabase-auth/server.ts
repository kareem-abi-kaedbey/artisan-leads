import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Session-scoped, publishable-key client. Never use the privileged backend key here.
export async function createAuthServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase Auth environment variables.");

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Proxy persists refreshed sessions.
        }
      },
    },
  });
}
