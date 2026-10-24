"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FollowUpSchema, type FollowUp } from "@/lib/ai/follow-up-schema";

const labels = { new: "Nouveau", contacted: "Contacté", quote_sent: "Devis envoyé", won: "Gagné", lost: "Perdu" };

export default function LeadFollowUpPanel({ leadId, status }: { leadId: string; status: string | null }) {
  const router = useRouter();
  const lock = useRef(false);
  const [proposal, setProposal] = useState<{ result: FollowUp; sourceStatus: string | null } | null>(null);
  const [operation, setOperation] = useState<"idle" | "preparing" | "approving">("idle");
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending");
  const [error, setError] = useState("");
  const [refreshing, startTransition] = useTransition();
  const busy = operation !== "idle" || refreshing;
  const result = proposal?.result;
  const stale = Boolean(proposal && proposal.sourceStatus !== status);
  const canApprove = Boolean(result && result.proposedStatus !== null && result.proposedStatus !== status && !stale && decision === "pending");

  async function prepare() {
    if (lock.current || busy) return;
    lock.current = true;
    setOperation("preparing");
    setProposal(null);
    setDecision("pending");
    setError("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/follow-up`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.message === "string" ? body.message : "Impossible de préparer le suivi. Veuillez réessayer.");
      const parsed = FollowUpSchema.safeParse(body?.followUp);
      if (body?.success !== true || !parsed.success) throw new Error("La proposition reçue est invalide. Veuillez préparer un nouveau suivi.");
      setProposal({ result: parsed.data, sourceStatus: status });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossible de préparer le suivi. Veuillez réessayer.");
    } finally {
      setOperation("idle");
      lock.current = false;
    }
  }

  async function approve() {
    if (lock.current || busy || !canApprove) return;
    // Revalidate the proposal at the action boundary, even though preparation validated it.
    const parsed = FollowUpSchema.safeParse(proposal?.result);
    if (!parsed.success || parsed.data.proposedStatus === null || parsed.data.proposedStatus === status || proposal?.sourceStatus !== status) return;
    lock.current = true;
    setOperation("approving");
    setError("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: parsed.data.proposedStatus }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.message === "string" ? body.message : "Impossible de mettre à jour le statut. Veuillez réessayer.");
      }
      setDecision("approved");
      startTransition(() => router.refresh());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossible de mettre à jour le statut. Veuillez réessayer.");
    } finally {
      setOperation("idle");
      lock.current = false;
    }
  }

  function reject() {
    if (lock.current || busy || !canApprove) return;
    setDecision("rejected");
    setError("");
  }

  return (
    <section aria-labelledby="follow-up-title" aria-busy={busy} className="rounded-sm border border-[#d9d0c3] border-t-2 border-t-[#967757] bg-[#fffcf7] p-5 sm:p-7">
      <p className="eyebrow text-[#70553e]">Suivi assisté · Validation humaine</p>
      <h2 id="follow-up-title" className="mt-2 text-lg font-semibold tracking-tight">Proposition de suivi IA</h2>
      <p className="mt-3 text-xs leading-6 text-stone-500">Cette proposition n’est pas une action appliquée. Aucun statut n’est modifié sans votre approbation et aucun message n’est envoyé.</p>
      <button type="button" onClick={prepare} disabled={busy} className="button button-dark mt-5 disabled:cursor-wait disabled:opacity-60">
        {operation === "preparing" ? "Préparation du suivi..." : "Préparer le suivi"}
      </button>
      {result && (
        <div className="mt-6 space-y-5 text-sm">
          {[
            ["Résumé", result.summary], ["Justification", result.reasoning],
            ["Action recommandée", result.recommendedAction], ["Réponse suggérée — non envoyée", result.suggestedReply],
          ].map(([title, value]) => <div key={title}><h3 className="font-semibold">{title}</h3><p className="mt-2 leading-7 whitespace-pre-wrap break-words text-stone-600">{value}</p></div>)}
          <div className="rounded-sm border border-[#d9d0c3] bg-[#f8f5ef] p-4">
            <h3 className="font-semibold">Statut proposé par l’IA</h3>
            <p className="mt-2 text-[#70553e]">{result.proposedStatus === null ? "Aucun changement proposé" : labels[result.proposedStatus]}</p>
            {decision === "pending" && stale && <p className="mt-2 text-xs leading-6 text-stone-600">Le statut a changé depuis cette proposition. Préparez un nouveau suivi avant d’approuver.</p>}
            {decision === "pending" && !stale && result.proposedStatus === status && <p className="mt-2 text-xs text-stone-500">Le statut proposé est déjà le statut actuel.</p>}
            {canApprove && <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={approve} disabled={busy} className="button button-dark disabled:opacity-60">{operation === "approving" || refreshing ? "Enregistrement..." : "Approuver"}</button>
              <button type="button" onClick={reject} disabled={busy} className="button button-outline disabled:opacity-60">Refuser</button>
            </div>}
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className={`mt-3 text-sm leading-6 ${error ? "text-red-700" : "text-stone-600"}`}>
        {error || (operation === "preparing" ? "L’IA prépare une proposition. Aucun changement n’est appliqué." : operation === "approving" || refreshing ? "Mise à jour du statut..." : decision === "approved" ? "Proposition approuvée : le statut a été mis à jour. Aucun message n’a été envoyé." : decision === "rejected" ? "Proposition refusée. Aucun changement n’a été appliqué." : result ? "Proposition prête à examiner." : "")}
      </p>
    </section>
  );
}
