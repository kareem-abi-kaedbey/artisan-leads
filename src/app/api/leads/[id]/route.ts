import { getAdminAccess } from "@/lib/supabase-auth/admin";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["new", "contacted", "quote_sent", "won", "lost"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getAdminAccess();
  if (access !== "admin") {
    return Response.json(
      { success: false, message: access === "unauthenticated" ? "Authentification requise." : "Accès refusé." },
      { status: access === "unauthenticated" ? 401 : 403 }
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const status = body && typeof body === "object" && "status" in body ? body.status : null;

  if (typeof status !== "string" || !allowedStatuses.has(status)) {
    return Response.json(
      { success: false, message: "Veuillez sélectionner un statut valide." },
      { status: 400 }
    );
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ success: false, message: "Demande introuvable." }, { status: 404 });
  }

  try {
    const { data, error } = await getSupabaseServer()
      .from("leads")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ success: false, message: "Demande introuvable." }, { status: 404 });
    }

    return Response.json({ success: true, id: data.id, status: data.status });
  } catch (error) {
    console.error("Failed to update lead status:", error);
    return Response.json(
      { success: false, message: "Impossible de mettre à jour le statut. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
