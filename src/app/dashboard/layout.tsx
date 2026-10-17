import { requireAdmin } from "@/lib/supabase-auth/admin";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <div className="border-b border-[#d9d0c3] bg-[#eae3d8]">
        <div className="page-width flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="eyebrow text-[#70553e]">Atelier Noyer · Administration</p>
          <form action={logout}><button type="submit" className="button button-outline text-xs">Se déconnecter</button></form>
        </div>
      </div>
      {children}
    </>
  );
}
