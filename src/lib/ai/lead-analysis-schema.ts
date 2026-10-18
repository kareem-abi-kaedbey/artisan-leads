import { z } from "zod";

export const LeadAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(700),
  priority: z.enum(["low", "medium", "high"]),
  priorityReason: z.string().trim().min(1).max(500),
  missingInformation: z.array(z.string().trim().min(1).max(200)).max(6),
  recommendedNextAction: z.string().trim().min(1).max(400),
  suggestedReply: z.string().trim().min(1).max(1600),
}).strict();

export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>;

// The same schema drives the model contract and local validation.
export const leadAnalysisJsonSchema = z.toJSONSchema(LeadAnalysisSchema);
