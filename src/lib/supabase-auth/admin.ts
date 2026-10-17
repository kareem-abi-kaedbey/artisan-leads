import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthServerClient } from "./server";

// React cache deduplicates verification within one render, never across requests.
export const getAdminAccess = cache(async () => {
  const supabase = await createAuthServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return "unauthenticated" as const;
  const adminId = process.env.ADMIN_USER_ID;
  return adminId && user.id === adminId ? "admin" as const : "forbidden" as const;
});

export async function requireAdmin() {
  const access = await getAdminAccess();
  if (access === "unauthenticated") redirect("/login");
  if (access === "forbidden") redirect("/login?error=forbidden");
}
