import LeadFollowUpPanel from "@/components/LeadFollowUpPanel";
import LeadAnalysisPanel from "@/components/LeadAnalysisPanel";
import { LeadAnalysisSchema } from "@/lib/ai/lead-analysis-schema";
import { requireAdmin } from "@/lib/supabase-auth/admin";
import Image from "next/image";
import LeadStatusControl from "@/components/LeadStatusControl";
import { LeadDate, StatusBadge } from "@/components/LeadDisplay";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type LeadDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function LeadDetailPage({
  params,
}: LeadDetailPageProps) {
  const { id } = await params;

  await requireAdmin();

  const supabase = getSupabaseServer();

  // 1. Get the lead itself.
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, location, project_type, budget, description, status, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (leadError) {
    console.error("Failed to load lead:", leadError);
    throw new Error("Impossible de charger cette demande.");
  }

  if (!lead) {
    notFound();
  }

  // Read persisted analysis only. Viewing or refreshing never invokes Gemini.
  const { data: analysisRow, error: analysisError } = await supabase
    .from("lead_ai_analysis")
    .select("summary, priority, priority_reason, missing_information, recommended_next_action, suggested_reply")
    .eq("lead_id", id)
    .maybeSingle();
  const parsedAnalysis = analysisRow ? LeadAnalysisSchema.safeParse({
    summary: analysisRow.summary,
    priority: analysisRow.priority,
    priorityReason: analysisRow.priority_reason,
    missingInformation: analysisRow.missing_information,
    recommendedNextAction: analysisRow.recommended_next_action,
    suggestedReply: analysisRow.suggested_reply,
  }) : null;
  if (analysisError || (parsedAnalysis && !parsedAnalysis.success)) {
    console.error("Failed to load saved lead analysis:", { code: analysisError?.code, invalidData: parsedAnalysis?.success === false });
  }

  // 2. Get all images linked to this lead.
  const { data: imageRows, error: imagesError } = await supabase
    .from("lead_images")
    .select(
      "id, storage_path, original_name, mime_type, size_bytes, created_at"
    )
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  if (imagesError) {
    console.error("Failed to load lead images:", imagesError);
    throw new Error("Impossible de charger les images.");
  }

  // 3. Generate temporary URLs for the private images.
  const images = await Promise.all(
    imageRows.map(async (image) => {
      const { data, error } = await supabase.storage
        .from("lead-images")
        .createSignedUrl(image.storage_path, 60 * 10);

      if (error) {
        console.error("Failed to create signed URL:", error);

        return {
          ...image,
          signedUrl: null,
        };
      }

      return {
        ...image,
        signedUrl: data.signedUrl,
      };
    })
  );

  return (
    <main className="page-width py-8 sm:py-12">
      <Link href="/dashboard" className="inline-flex items-center gap-2 py-2 text-sm text-[#70553e] underline decoration-[#b9aa96] underline-offset-4 hover:text-[#302b25]">
        <span aria-hidden="true">←</span> Retour aux demandes
      </Link>

      <header className="mt-5 border-b border-[#d9d0c3] pb-7">
        <p className="eyebrow text-[#70553e]">Atelier Noyer · Demande de devis</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <h1 className="section-title min-w-0 break-words">{lead.name || "Nom non renseigné"}</h1>
          <StatusBadge status={lead.status} />
        </div>
        <p className="mt-4 text-sm text-stone-500">Reçue le <LeadDate value={lead.created_at} /></p>
      </header>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <aside className="grid min-w-0 gap-6" aria-label="Informations sur la demande">
          <section aria-labelledby="project-info-title" className="rounded-sm border border-[#d9d0c3] border-t-2 border-t-[#967757] bg-[#fffcf7] p-5 sm:p-6">
            <h2 id="project-info-title" className="text-lg font-semibold tracking-tight">En bref</h2>
            <dl className="mt-5 space-y-5 text-sm">
              {[
                ["Type de projet", lead.project_type],
                ["Localisation", lead.location],
                ["Budget", lead.budget],
              ].map(([label, value]) => (
                <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1.5 font-medium break-words">{value || "Non renseigné"}</dd></div>
              ))}
            </dl>
            <LeadStatusControl leadId={lead.id} status={lead.status} />
          </section>

          <section aria-labelledby="contact-title" className="rounded-sm border border-[#d9d0c3] bg-[#eae3d8] p-5 sm:p-6">
            <h2 id="contact-title" className="text-lg font-semibold tracking-tight">Coordonnées</h2>
            <dl className="mt-5 space-y-5 text-sm">
              <div><dt className="text-xs text-stone-600">Email</dt><dd className="mt-1.5 break-words">{lead.email ? <a href={`mailto:${lead.email}`} className="underline decoration-[#b9aa96] underline-offset-4">{lead.email}</a> : "Non renseigné"}</dd></div>
              <div><dt className="text-xs text-stone-600">Téléphone</dt><dd className="mt-1.5 break-words">{lead.phone ? <a href={`tel:${lead.phone}`} className="underline decoration-[#b9aa96] underline-offset-4">{lead.phone}</a> : "Non renseigné"}</dd></div>
            </dl>
            <div className="mt-6 flex flex-col gap-3 border-t border-[#cfc4b5] pt-5">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}?subject=${encodeURIComponent(lead.project_type ? `Votre demande de devis — ${lead.project_type}` : "Votre demande de devis — Atelier Noyer")}`}
                  className="button button-dark w-full"
                >
                  Répondre par email <span aria-hidden="true">↗</span>
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="button button-outline w-full">
                  Appeler <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </section>
        </aside>

        <div className="grid min-w-0 gap-6">
          <section aria-labelledby="description-title" className="rounded-sm border border-[#d9d0c3] bg-[#fffcf7] p-5 sm:p-7">
            <p className="eyebrow text-[#70553e]">Le besoin exprimé</p>
            <h2 id="description-title" className="mt-2 text-lg font-semibold tracking-tight">Description du projet</h2>
            <p className="mt-5 text-sm leading-7 whitespace-pre-wrap break-words text-stone-600">{lead.description || "Aucune description renseignée."}</p>
          </section>

          <LeadAnalysisPanel
            leadId={lead.id}
            analysis={parsedAnalysis?.success ? parsedAnalysis.data : null}
            loadError={Boolean(analysisError) || parsedAnalysis?.success === false}
          />

          <LeadFollowUpPanel key={lead.id} leadId={lead.id} status={lead.status} />

          <section aria-labelledby="images-title" className="rounded-sm border border-[#d9d0c3] bg-[#fffcf7] p-5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="images-title" className="text-lg font-semibold tracking-tight">Photos et inspirations</h2>
              <span className="text-xs text-stone-500">{images.length} pièce{images.length > 1 ? "s" : ""} jointe{images.length > 1 ? "s" : ""}</span>
            </div>
            {images.length === 0 ? (
              <p className="mt-5 rounded-sm border border-dashed border-[#c8baa7] bg-[#f8f5ef] px-5 py-8 text-center text-sm text-stone-500">Aucune photo jointe à cette demande.</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {images.map((image, index) => {
                  const filename = image.original_name || `Photo du projet ${index + 1}`;
                  return (
                    <figure key={image.id} className="min-w-0 overflow-hidden rounded-sm border border-[#d9d0c3]">
                      {image.signedUrl ? (
                        <a href={image.signedUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/3] bg-[#eae3d8]" aria-label={`Ouvrir ${filename} dans un nouvel onglet`}>
                          <Image src={image.signedUrl} alt={`Photo jointe : ${filename}`} fill unoptimized className="object-cover" sizes="(max-width: 639px) 100vw, 50vw" />
                        </a>
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-[#eae3d8] px-4 text-center text-sm text-stone-600">Image indisponible pour le moment.</div>
                      )}
                      <figcaption className="border-t border-[#d9d0c3] px-4 py-3 text-xs leading-5 break-words text-stone-600">{filename}</figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
