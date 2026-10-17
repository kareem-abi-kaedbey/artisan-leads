"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthServerClient } from "@/lib/supabase-auth/server";

export async function login(_previous: { error: string }, formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const invalid = { error: "Connexion impossible. Vérifiez vos identifiants et réessayez." };
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) return invalid;

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return invalid;

  // Verify identity with Auth before trusting the newly established session.
  const { data: { user }, error: verificationError } = await supabase.auth.getUser();
  if (verificationError || !user || !process.env.ADMIN_USER_ID || user.id !== process.env.ADMIN_USER_ID) {
    await supabase.auth.signOut({ scope: "local" });
    return invalid;
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("La déconnexion a échoué. Veuillez réessayer.");
  revalidatePath("/dashboard", "layout");
  redirect("/login");
}
