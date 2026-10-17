import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getAdminAccess } from "@/lib/supabase-auth/admin";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const access = await getAdminAccess();
  if (access === "admin") redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="text-xl font-semibold tracking-tight">Atelier Noyer<span className="text-[#967757]">.</span></Link>
        <section className="mt-6 rounded-sm border border-[#d9d0c3] border-t-2 border-t-[#967757] bg-[#fffcf7] p-6 sm:p-8" aria-labelledby="login-title">
          <p className="eyebrow text-[#70553e]">Espace administration</p>
          <h1 id="login-title" className="section-title mt-3">Connexion</h1>
          <p className="mt-4 text-sm leading-6 text-stone-600">Connectez-vous pour consulter et suivre les demandes de devis.</p>
          {access === "forbidden" ? (
            <div className="mt-6">
              <p role="alert" className="text-sm leading-6 text-red-700">Ce compte n’est pas autorisé à accéder à l’administration.</p>
              <form action={logout} className="mt-5"><button className="button button-outline w-full" type="submit">Se déconnecter</button></form>
            </div>
          ) : <LoginForm />}
        </section>
        <p className="mt-5 text-center text-xs text-stone-500">Accès réservé à l’administrateur.</p>
      </div>
    </main>
  );
}
