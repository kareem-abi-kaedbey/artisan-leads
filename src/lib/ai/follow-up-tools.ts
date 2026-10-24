import "server-only";

import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase-server";
import { LeadAnalysisSchema } from "./lead-analysis-schema";
import { EmptyToolArgumentsSchema, ToolNameSchema } from "./follow-up-schema";

const ContextSchema = z.object({
  project_type: z.string().max(200).nullable(),
  location: z.string().max(500).nullable(),
  budget: z.string().max(200).nullable(),
  description: z.string().max(10000).nullable(),
  status: z.enum(["new", "contacted", "quote_sent", "won", "lost"]),
  created_at: z.string().datetime({ offset: true }),
});

const businessRules = [
  "Zone de service : Paris et Île-de-France ; faire confirmer la faisabilité ailleurs.",
  "Ne jamais promettre un prix sans devis humain.",
  "Ne jamais promettre un délai non confirmé.",
  "Clarifier les demandes incomplètes avant de s’engager.",
  "Les décisions commerciales finales et l’envoi des réponses restent humains.",
];

export class FollowUpLeadNotFoundError extends Error {
  constructor() { super("Lead not found"); this.name = "FollowUpLeadNotFoundError"; }
}

// Load a minimized snapshot before the first paid request; route ID is closure-only.
export async function createFollowUpTools(leadId: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("leads")
    .select("project_type, location, budget, description, status, created_at")
    .eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!data) throw new FollowUpLeadNotFoundError();
  // Zod strips any unexpected database fields; they never reach the model.
  const context = ContextSchema.parse(data);

  return async function executeTool(name: unknown, args: unknown) {
    const tool = ToolNameSchema.parse(name);
    EmptyToolArgumentsSchema.parse(args); // Reject IDs, URLs, filters, and all other arguments.
    switch (tool) {
      case "get_lead_context":
        return ContextSchema.parse(context);
      case "get_business_rules":
        return { rules: z.array(z.string().min(1).max(300)).length(5).parse(businessRules) };
      case "get_existing_analysis": {
        const { data: row, error: analysisError } = await supabase.from("lead_ai_analysis")
          .select("summary, priority, priority_reason, missing_information, recommended_next_action, suggested_reply")
          .eq("lead_id", leadId).maybeSingle();
        if (analysisError) throw analysisError;
        if (!row) return { found: false, analysis: null };
        const analysis = LeadAnalysisSchema.parse({
          summary: row.summary, priority: row.priority, priorityReason: row.priority_reason,
          missingInformation: row.missing_information,
          recommendedNextAction: row.recommended_next_action, suggestedReply: row.suggested_reply,
        });
        return { found: true, analysis };
      }
    }
  };
}
