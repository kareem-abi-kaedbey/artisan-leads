import { createClient } from "@supabase/supabase-js";

function createSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

type SupabaseServerClient =
  ReturnType<typeof createSupabaseServerClient>;

let supabaseServer: SupabaseServerClient | null = null;

export function getSupabaseServer() {
  if (!supabaseServer) {
    supabaseServer = createSupabaseServerClient();
  }

  return supabaseServer;
}