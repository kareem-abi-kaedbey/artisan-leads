"use client";

import { useActionState } from "react";
import { login } from "@/app/login/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });

  return (
    <form action={action} className="mt-7 grid gap-5" aria-busy={pending}>
      <label className="grid gap-2 text-sm font-medium">
        Email
        <input type="email" name="email" autoComplete="username" required className="rounded-sm border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e] focus:ring-1 focus:ring-[#70553e]" />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Mot de passe
        <input type="password" name="password" autoComplete="current-password" required className="rounded-sm border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e] focus:ring-1 focus:ring-[#70553e]" />
      </label>
      <button type="submit" disabled={pending} className="button button-dark mt-1 w-full disabled:cursor-wait disabled:opacity-60">{pending ? "Connexion..." : "Se connecter"}</button>
      <p role="status" aria-live="polite" className="text-sm leading-6 text-red-700">{state.error}</p>
    </form>
  );
}
