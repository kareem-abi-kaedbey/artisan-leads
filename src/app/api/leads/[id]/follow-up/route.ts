import { createFollowUpTrace } from "@/lib/ai/follow-up-trace";
import { getAdminAccess } from "@/lib/supabase-auth/admin";
import { createFollowUpTools, FollowUpLeadNotFoundError } from "@/lib/ai/follow-up-tools";
import { runFollowUpAgent, FOLLOW_UP_MODEL } from "@/lib/ai/follow-up-agent";
import { FollowUpSchema } from "@/lib/ai/follow-up-schema";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const trace = createFollowUpTrace(FOLLOW_UP_MODEL);
  let phase = "authorization";
  try {
    const access = await getAdminAccess();
    if (access !== "admin") {
      trace.finish(access === "unauthenticated" ? "unauthenticated" : "forbidden");
      return Response.json(
        { success: false, message: access === "unauthenticated" ? "Authentification requise." : "Accès refusé." },
        { status: access === "unauthenticated" ? 401 : 403 }
      );
    }
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      trace.finish("not_found");
      return Response.json({ success: false, message: "Demande introuvable." }, { status: 404 });
    }
    phase = "context";
    trace.phase("context");
    const executeTool = await createFollowUpTools(id);
    phase = "agent";
    const followUp = FollowUpSchema.parse(await runFollowUpAgent(executeTool, trace));
    trace.finish("completed");
    return Response.json({ success: true, followUp }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FollowUpLeadNotFoundError) {
      trace.finish("not_found");
      return Response.json({ success: false, message: "Demande introuvable." }, { status: 404 });
    }
    trace.finish("failed", error);
    return Response.json(
      { success: false, message: "Impossible de préparer la recommandation de suivi. Veuillez réessayer." },
      { status: phase === "agent" ? 502 : 500 }
    );
  }
}
