import type { LeadAnalysis } from "@/lib/ai/lead-analysis-schema";
import LeadAnalysisButton from "./LeadAnalysisButton";

const priorities = {
  low: { label: "Basse", className: "border-stone-200 bg-stone-100 text-stone-600" },
  medium: { label: "Moyenne", className: "border-amber-200 bg-amber-50 text-amber-900" },
  high: { label: "Haute", className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
};

export default function LeadAnalysisPanel({ leadId, analysis, loadError }: { leadId: string; analysis: LeadAnalysis | null; loadError: boolean }) {
  const priority = analysis ? priorities[analysis.priority] : null;
  return (
    <section aria-labelledby="analysis-title" className="rounded-sm border border-[#d9d0c3] border-t-2 border-t-[#967757] bg-[#fffcf7] p-5 sm:p-7">
      <p className="eyebrow text-[#70553e]">Aide à la qualification</p>
      <h2 id="analysis-title" className="mt-2 text-lg font-semibold tracking-tight">Analyse IA</h2>
      <p className="mt-3 text-xs leading-6 text-stone-500">Une aide à la décision à vérifier. Vous restez responsable du suivi et de la réponse ; aucun message n’est envoyé automatiquement.</p>
      {loadError ? (
        <p className="mt-5 text-sm text-red-700">Impossible de charger l’analyse enregistrée. Veuillez actualiser la page.</p>
      ) : analysis ? (
        <div className="mt-5 space-y-5 text-sm">
          <div><h3 className="font-semibold">Résumé</h3><p className="mt-2 leading-7 whitespace-pre-wrap break-words text-stone-600">{analysis.summary}</p></div>
          <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">Priorité</h3><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priority!.className}`}>{priority!.label}</span></div>
          <div><h3 className="font-semibold">Pourquoi</h3><p className="mt-2 leading-7 break-words text-stone-600">{analysis.priorityReason}</p></div>
          <div><h3 className="font-semibold">Informations à préciser</h3>{analysis.missingInformation.length ? <ul className="mt-2 list-disc space-y-2 pl-5 leading-6 text-stone-600">{analysis.missingInformation.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul> : <p className="mt-2 text-stone-600">Aucune précision supplémentaire identifiée.</p>}</div>
          <div><h3 className="font-semibold">Prochaine action recommandée</h3><p className="mt-2 leading-7 break-words text-stone-600">{analysis.recommendedNextAction}</p></div>
          <div className="rounded-sm border border-[#d9d0c3] bg-[#f8f5ef] p-4"><h3 className="font-semibold">Réponse suggérée</h3><p className="mt-3 leading-7 whitespace-pre-wrap break-words text-stone-600">{analysis.suggestedReply}</p></div>
        </div>
      ) : (
        <p className="mt-5 text-sm leading-7 text-stone-600">Générez un résumé, une priorité et une réponse suggérée à partir du projet, de la localisation, du budget et de la description. L’analyse sera enregistrée et ne sera régénérée qu’à votre demande.</p>
      )}
      {!loadError && <LeadAnalysisButton leadId={leadId} hasAnalysis={Boolean(analysis)} />}
    </section>
  );
}
