import { getAdminAccess } from "@/lib/supabase-auth/admin";
import { getSupabaseServer } from "@/lib/supabase-server";
import { analyzeLead, LEAD_ANALYSIS_MODEL } from "@/lib/ai/gemini";
import { LeadAnalysisSchema } from "@/lib/ai/lead-analysis-schema";

export const dynamic = "force-dynamic";

const analysisColumns = "id, lead_id, summary, priority, priority_reason, missing_information, recommended_next_action, suggested_reply, model, created_at, updated_at";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let phase = "authorization";
  try {
    const access = await getAdminAccess();
    if (access !== "admin") {
      return Response.json(
        { success: false, message: access === "unauthenticated" ? "Authentification requise." : "Accès refusé." },
        { status: access === "unauthenticated" ? 401 : 403 }
      );
    }
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return Response.json({ success: false, message: "Demande introuvable." }, { status: 404 });
    }

    phase = "lead lookup";
    const supabase = getSupabaseServer();
    const { data: lead, error } = await supabase.from("leads")
      .select("project_type, location, budget, description").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!lead) return Response.json({ success: false, message: "Demande introuvable." }, { status: 404 });

    phase = "generation";
    // Only this explicit endpoint calls the provider, exactly once. Never trust request text.
    const analysis = LeadAnalysisSchema.parse(await analyzeLead(lead));

    phase = "persistence";
    const { data: saved, error: saveError } = await supabase.from("lead_ai_analysis").upsert({
      lead_id: id,
      summary: analysis.summary,
      priority: analysis.priority,
      priority_reason: analysis.priorityReason,
      missing_information: analysis.missingInformation,
      recommended_next_action: analysis.recommendedNextAction,
      suggested_reply: analysis.suggestedReply,
      model: LEAD_ANALYSIS_MODEL,
      updated_at: new Date().toISOString(),
    }, { onConflict: "lead_id" }).select(analysisColumns).single();
    if (saveError) throw saveError;

    return Response.json({ success: true, analysis: saved });
  } catch (error) {
    // Do not log prompt contents, model output, credentials or provider request headers.
    const detail = error && typeof error === "object" ? error as { name?: string; status?: number; code?: string } : {};
    console.error("Lead analysis failed:", { phase, name: detail.name, status: detail.status, code: detail.code });
    return Response.json(
      { success: false, message: phase === "generation" ? "L’analyse IA n’a pas pu être générée. Veuillez réessayer." : "Impossible d’enregistrer ou de charger l’analyse. Veuillez réessayer." },
      { status: phase === "generation" ? 502 : 500 }
    );
  }
}
