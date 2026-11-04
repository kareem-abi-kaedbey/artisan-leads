import { readFileSync } from "node:fs";
import { z } from "zod";
import { schemas, analysisSchemas } from "./runtime.mjs";

const statuses = z.enum(["new", "contacted", "quote_sent", "won", "lost"]);
export const DatasetSchema = z.object({
  version: z.literal("follow-up-eval-v1"),
  scenarios: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    tags: z.array(z.string().min(1)).min(1),
    context: z.object({
      project_type: z.string().nullable(), location: z.string().nullable(), budget: z.string().nullable(),
      description: z.string().nullable(), status: statuses, created_at: z.string().datetime({ offset: true }),
    }).strict(),
    existingAnalysis: analysisSchemas.LeadAnalysisSchema.nullable(),
    expectations: z.object({
      forbiddenStatuses: z.array(statuses),
      clarificationTopics: z.array(z.enum(["dimensions", "budget", "project", "deadline", "finishes", "intent"])),
      outsideArea: z.boolean(),
      nonCustomerSolicitation: z.boolean().optional(),
    }).strict(),
  }).strict()).min(15).max(20),
}).strict().superRefine((dataset, ctx) => {
  if (new Set(dataset.scenarios.map((item) => item.id)).size !== dataset.scenarios.length) ctx.addIssue({ code: "custom", message: "Scenario IDs must be unique" });
});

export function loadDataset() {
  return DatasetSchema.parse(JSON.parse(readFileSync(new URL("./scenarios.json", import.meta.url), "utf8")));
}
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’‘]/g, "'");
const topics = {
  dimensions: /dimension|mesur|largeur|hauteur|profondeur|surface|plan|metrage/,
  budget: /budget|enveloppe|fourchette|montant envisage/,
  project: /projet|besoin|amenagement|type de|souhait/,
  deadline: /delai|date|calendrier|echeance|disponibilite|planning/,
  finishes: /finition|matiere|materiau|essence|bois|couleur/,
  intent: /confirm|reel|test|intention|besoin|authentic|verifi/,
};
// A dimension reference must be coupled to a request/action in the same clause.
// Merely saying that measurements are missing (or mentioning another question)
// is not itself clarification.
function clarifiesDimensions(text) {
  return text.split(/[.!?;\n]+/).some((clause) =>
    topics.dimensions.test(clause)
    && /\b(?:demander|demandez|obtenir|recueillir|collecter|recuperer|transmettre|envoyer|communiquer|fournir|relever|prendre|relancer|relancez|preciser|confirmer|indiquer|clarifier|verifier|completer|solliciter|mesurer)\b|\b(?:avez|auriez|pourriez|pouvez|voudriez)[- ]vous\b|\bquell?e?s?\b/.test(clause)
    && !/\bne\b.{0,30}\bpas\b|\b(?:inutile de|pas besoin de|sans demander)\b/.test(clause)
  );
}

function handlesNonCustomerSolicitation(text, actionReply, action) {
  const recognizes = /\b(?:spam|pourriel|demarchage)\b|(?:sollicitation|offre|message).{0,80}(?:marketing|commercial|promotion|hors|non pertinent|sans lien)|(?:aucun|pas de) (?:vrai )?projet/.test(text);
  const disengages = /\b(?:classer|archiver|ecarter|ignorer|rejeter)\b|\bne pas (?:donner suite|relancer|repondre|contacter)\b|\bsans (?:suite|relance|reponse|suivi)\b|\baucune? (?:relance|suivi|reponse)\b/.test(action);
  // Remove explicitly negated outreach verbs before looking for an invitation
  // to engage. A courteous decline is allowed; asking for a project is not.
  const affirmative = actionReply.replace(/\bne pas (?:relancer|repondre|contacter|appeler|demander|solliciter)\b/g, "");
  const invitesEngagement = /\b(?:relancer|relancez|contacter|contactez|appeler|appelez|demander|demandez|solliciter)\b|\b(?:pouvez|pourriez|avez|auriez)[- ]vous\b|\bquell?e?s?\b|proposer (?:un|une) (?:devis|rendez-vous|visite)/.test(affirmative);
  return recognizes && disengages && !invitesEngagement;
}

function monetaryAmounts(text) {
  return [...text.matchAll(/\b(\d[\d \u00a0\u202f]*(?:[.,]\d{1,2})?)\s*(?:€|euros?\b)/gi)].map((match) => match[1].replace(/\s/g, "").replace(",", "."));
}
function measurements(text) {
  return [...normalize(text).matchAll(/\b\d+(?:[.,]\d+)?\s*(?:cm|mm|m2|m²|metres?|m)\b/g)].map((match) => match[0].replace(/\s/g, ""));
}

// Deterministic warning checks, not an LLM judge or a proof of semantic accuracy.
export function evaluate(scenario, output) {
  const parsed = schemas.FollowUpSchema.safeParse(output);
  if (!parsed.success) return { passed: false, failures: ["schema"], checks: ["schema"] };
  const result = parsed.data;
  const failures = [];
  const checks = ["schema", "allowed_status_transition", "no_new_price", "no_price_promise", "no_confirmed_deadline", "no_new_measurements", "no_new_dates"];
  const text = normalize(Object.values(result).filter((value) => typeof value === "string").join("\n"));
  const actionReply = normalize(`${result.recommendedAction}\n${result.suggestedReply}`);
  const source = JSON.stringify({ context: scenario.context, existingAnalysis: scenario.existingAnalysis });
  if (result.proposedStatus !== null && scenario.expectations.forbiddenStatuses.includes(result.proposedStatus)) failures.push("allowed_status_transition");
  const knownAmounts = new Set(monetaryAmounts(source));
  if (monetaryAmounts(text).some((value) => !knownAmounts.has(value))) failures.push("no_new_price");
  // Provided budgets can be repeated, but must not be converted into confirmed quotes.
  if (/\b(?:le prix|le cout|le tarif|le devis)\s+(?:total\s+)?(?:sera|est|s'eleve a|est fixe a)\s+(?:de\s+)?\d/.test(actionReply)) failures.push("no_price_promise");
  if (/\b(?:nous (?:livrerons|installerons|interviendrons)|(?:la pose|la livraison|l'installation|l'intervention) (?:est confirmee|est garantie|aura lieu|est prevue))\b/.test(actionReply)) failures.push("no_confirmed_deadline");
  const knownMeasurements = new Set(measurements(source));
  if (measurements(text).some((value) => !knownMeasurements.has(value))) failures.push("no_new_measurements");
  const dates = text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g) ?? [];
  if (dates.some((date) => !source.includes(date))) failures.push("no_new_dates");
  for (const topic of scenario.expectations.clarificationTopics) {
    const criterion = `clarification_${topic}`;
    checks.push(criterion);
    const clarified = topic === "dimensions"
      ? clarifiesDimensions(actionReply)
      : topics[topic].test(actionReply) && /precis|confirm|quel|indiqu|clarif|demand|verifi|echang|complet|pourriez|pouvez|savoir/.test(actionReply);
    if (!clarified) failures.push(criterion);
  }
  if (scenario.expectations.nonCustomerSolicitation) {
    checks.push("non_customer_solicitation");
    if (!handlesNonCustomerSolicitation(text, actionReply, normalize(result.recommendedAction))) failures.push("non_customer_solicitation");
  }
  if (scenario.expectations.outsideArea) {
    checks.push("service_area");
    if (!/zone|secteur|perimetre|ile-de-france|paris|hors.*region/.test(actionReply) || !/verifi|confirm|faisabilite|hors|limite|desserv|couvr|interven|deplac/.test(actionReply)) failures.push("service_area");
  }
  return { passed: failures.length === 0, failures, checks };
}
