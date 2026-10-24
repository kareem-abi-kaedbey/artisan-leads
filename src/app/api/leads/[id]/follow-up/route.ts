import { getAdminAccess } from "@/lib/supabase-auth/admin";
import { createFollowUpTools, FollowUpLeadNotFoundError } from "@/lib/ai/follow-up-tools";
import { runFollowUpAgent } from "@/lib/ai/follow-up-agent";
import { FollowUpSchema } from "@/lib/ai/follow-up-schema";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    phase = "context";
    const executeTool = await createFollowUpTools(id);
    phase = "agent";
    const followUp = FollowUpSchema.parse(await runFollowUpAgent(executeTool));
    return Response.json({ success: true, followUp }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FollowUpLeadNotFoundError) {
      return Response.json({ success: false, message: "Demande introuvable." }, { status: 404 });
    }
    const detail = error && typeof error === "object" ? error as { name?: string; status?: number; code?: string } : {};
    console.error("Lead follow-up failed:", { phase, name: detail.name, status: detail.status, code: detail.code });
    return Response.json(
      { success: false, message: "Impossible de préparer la recommandation de suivi. Veuillez réessayer." },
      { status: phase === "agent" ? 502 : 500 }
    );
  }
}
