import type { z } from "zod";
import type { moderationActionSchema, reportInputSchema } from "./schema";

export type ReportInput = z.infer<typeof reportInputSchema>;
export type ModerationActionInput = z.infer<typeof moderationActionSchema>;
