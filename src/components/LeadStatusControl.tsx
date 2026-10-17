"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const options = [
  { value: "new", label: "Nouveau" },
  { value: "contacted", label: "Contacté" },
  { value: "quote_sent", label: "Devis envoyé" },
  { value: "won", label: "Gagné" },
  { value: "lost", label: "Perdu" },
];

export default function LeadStatusControl({ leadId, status }: { leadId: string; status: string | null }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const busy = isSaving || isRefreshing;

  async function updateStatus(nextStatus: string) {
    if (busy || nextStatus === status) return;
    setIsSaving(true);
    setError("");
    setSaved(false);

    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.message === "string" ? body.message : "Impossible de mettre à jour le statut. Veuillez réessayer.");
      }
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Impossible de mettre à jour le statut. Veuillez réessayer.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-6 border-t border-[#e5ddd1] pt-5" aria-busy={busy}>
      <label htmlFor="lead-status" className="block text-xs font-medium text-stone-600">Modifier le statut</label>
      <select
        id="lead-status"
        value={status ?? ""}
        disabled={busy}
        onChange={(event) => updateStatus(event.target.value)}
        aria-describedby="lead-status-feedback"
        className="mt-2 w-full rounded-sm border border-[#cfc4b5] bg-[#f8f5ef] px-3 py-3 text-sm outline-none focus:border-[#70553e] focus:ring-1 focus:ring-[#70553e] disabled:cursor-wait disabled:opacity-60"
      >
        {!options.some((option) => option.value === status) && <option value={status ?? ""} disabled>Non renseigné</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <p id="lead-status-feedback" role="status" aria-live="polite" className={`mt-2 text-xs leading-5 ${error ? "text-red-700" : "text-stone-500"}`}>
        {busy ? "Enregistrement..." : error || (saved ? "Statut mis à jour." : "Le changement est enregistré automatiquement.")}
      </p>
    </div>
  );
}
