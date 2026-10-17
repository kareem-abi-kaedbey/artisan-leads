import Link from "next/link";
import { LeadDate, StatusBadge } from "@/components/LeadDisplay";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = getSupabaseServer();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, location, project_type, budget, status, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Impossible de charger les leads.");
  }

  const summary = [
    { label: "Total", count: leads.length, detail: "Demandes reçues", accent: "border-t-[#967757]" },
    { label: "Nouvelles", count: leads.filter((lead) => lead.status === "new").length, detail: "À prendre en charge", accent: "border-t-amber-600" },
    { label: "Contactées", count: leads.filter((lead) => lead.status === "contacted").length, detail: "Premier contact établi", accent: "border-t-sky-700" },
  ];

  return (
    <main className="page-width py-8 sm:py-12">
      <header className="border-b border-[#d9d0c3] pb-7">
        <p className="eyebrow text-[#70553e]">Atelier Noyer · Tableau de bord</p>
        <h1 className="section-title mt-3">Demandes de devis</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
          Retrouvez les demandes entrantes et consultez leur statut en un coup d’œil.
        </p>
      </header>

      <section aria-label="Vue d’ensemble des demandes" className="mt-7">
        <dl className="grid gap-3 sm:grid-cols-3 sm:gap-5">
          {summary.map((item) => (
            <div key={item.label} className={`rounded-sm border border-[#d9d0c3] border-t-2 bg-[#fffcf7] px-5 py-5 sm:px-6 ${item.accent}`}>
              <dt className="text-sm font-medium text-stone-600">{item.label}</dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{item.count}</dd>
              <dd className="mt-2 text-xs text-stone-500">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="lead-list-title" className="mt-9">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="lead-list-title" className="text-lg font-semibold tracking-tight">Toutes les demandes</h2>
          <p className="text-xs text-stone-500">Les plus récentes en premier</p>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-sm border border-dashed border-[#c8baa7] bg-[#fffcf7] px-6 py-14 text-center">
            <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eae3d8] text-xl text-[#70553e]">✉</span>
            <h3 className="mt-5 text-lg font-medium">Aucune demande pour le moment</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-600">Les demandes envoyées depuis le formulaire de devis apparaîtront ici.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-sm border border-[#d9d0c3] bg-[#fffcf7] lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">Demandes de devis classées de la plus récente à la plus ancienne</caption>
                <thead className="border-b border-[#d9d0c3] bg-[#eae3d8] text-xs text-stone-600">
                  <tr>
                    {["Nom", "Type de projet", "Localisation", "Budget", "Statut", "Reçue le"].map((label) => (
                      <th key={label} scope="col" className="px-4 py-4 font-medium">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5ddd1]">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="align-top hover:bg-[#f4f0e8] focus-within:bg-[#f4f0e8]">
                      <th scope="row" className="px-4 py-5 font-semibold break-words"><Link href={`/dashboard/leads/${lead.id}`} className="text-[#70553e] underline decoration-[#b9aa96] underline-offset-4 hover:text-[#302b25]">{lead.name || "Non renseigné"}<span aria-hidden="true" className="ml-1">↗</span></Link></th>
                      <td className="px-4 py-5 break-words text-stone-600">{lead.project_type || "Non renseigné"}</td>
                      <td className="px-4 py-5 break-words text-stone-600">{lead.location || "Non renseignée"}</td>
                      <td className="px-4 py-5 break-words text-stone-600">{lead.budget || "Non renseigné"}</td>
                      <td className="px-4 py-5"><StatusBadge status={lead.status} /></td>
                      <td className="px-4 py-5 text-xs leading-6 text-stone-500"><LeadDate value={lead.created_at} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="grid gap-4 md:grid-cols-2 lg:hidden">
              {leads.map((lead) => (
                <li key={lead.id} className="min-w-0 rounded-sm border border-[#d9d0c3] bg-[#fffcf7] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="min-w-0 text-base font-semibold break-words"><Link href={`/dashboard/leads/${lead.id}`} className="text-[#70553e] underline decoration-[#b9aa96] underline-offset-4 hover:text-[#302b25]">{lead.name || "Non renseigné"}<span aria-hidden="true" className="ml-1">↗</span></Link></h3>
                    <StatusBadge status={lead.status} />
                  </div>
                  <p className="mt-2 text-sm break-words text-[#70553e]">{lead.project_type || "Projet non renseigné"}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[#e5ddd1] pt-4 text-sm">
                    <div className="min-w-0"><dt className="text-xs text-stone-500">Localisation</dt><dd className="mt-1 break-words">{lead.location || "Non renseignée"}</dd></div>
                    <div className="min-w-0"><dt className="text-xs text-stone-500">Budget</dt><dd className="mt-1 break-words">{lead.budget || "Non renseigné"}</dd></div>
                    <div className="col-span-2"><dt className="text-xs text-stone-500">Reçue le</dt><dd className="mt-1"><LeadDate value={lead.created_at} /></dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
