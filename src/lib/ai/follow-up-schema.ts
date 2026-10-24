import { z } from "zod";

export const FollowUpSchema = z.object({
  summary: z.string().trim().min(1).max(700),
  // A short factual justification, not a request for hidden chain-of-thought.
  reasoning: z.string().trim().min(1).max(700),
  recommendedAction: z.string().trim().min(1).max(500),
  suggestedReply: z.string().trim().min(1).max(1600),
  proposedStatus: z.enum(["new", "contacted", "quote_sent", "won", "lost"]).nullable(),
}).strict();

export type FollowUp = z.infer<typeof FollowUpSchema>;
export const followUpJsonSchema = z.toJSONSchema(FollowUpSchema);
export const ToolNameSchema = z.enum(["get_lead_context", "get_existing_analysis", "get_business_rules"]);
export type FollowUpToolName = z.infer<typeof ToolNameSchema>;
export const EmptyToolArgumentsSchema = z.object({}).strict();
export const ToolCallSchema = z.object({
  type: z.literal("function_call"),
  id: z.string().min(1).max(200),
  name: ToolNameSchema,
  arguments: EmptyToolArgumentsSchema,
}).strict();
