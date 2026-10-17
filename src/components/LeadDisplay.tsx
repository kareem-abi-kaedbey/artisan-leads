const statuses: Record<string, { label: string; className: string }> = {
  new: { label: "Nouveau", className: "border-amber-200 bg-amber-50 text-amber-900" },
  contacted: { label: "Contacté", className: "border-sky-200 bg-sky-50 text-sky-900" },
  quote_sent: { label: "Devis envoyé", className: "border-violet-200 bg-violet-50 text-violet-900" },
  won: { label: "Gagné", className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  lost: { label: "Perdu", className: "border-stone-200 bg-stone-100 text-stone-600" },
};

export function StatusBadge({ status }: { status: string | null }) {
  const badge = statuses[status ?? ""] ?? {
    label: "Non renseigné",
    className: "border-stone-200 bg-stone-100 text-stone-600",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {badge.label}
    </span>
  );
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function LeadDate({ value }: { value: string | null }) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return <span>Date non renseignée</span>;
  }
  return <time dateTime={value}>{dateFormatter.format(new Date(value))}</time>;
}

