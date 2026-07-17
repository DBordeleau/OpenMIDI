import type { z } from "zod";
import type { feedbackKindSchema, feedbackStatusSchema } from "./schema";

export type FeedbackKind = z.infer<typeof feedbackKindSchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export type FeedbackFormState = {
  message?: string;
  referenceId?: string;
  fieldErrors?: Partial<
    Record<"kind" | "summary" | "details" | "browserContext", string>
  >;
};

export type AdminFeedbackQueueItem = {
  id: string;
  referenceId: string;
  kind: FeedbackKind;
  summary: string;
  sourcePathname: string;
  createdAt: string;
  status: FeedbackStatus;
  lockVersion: number;
  hasBrowserContext: boolean;
};

export type AdminFeedbackDetail = {
  id: string;
  referenceId: string;
  kind: FeedbackKind;
  summary: string;
  details: string;
  sourcePathname: string;
  applicationVersion: string;
  browserContext: string | null;
  status: FeedbackStatus;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
  handledAt: string | null;
  handledBy: string | null;
  adminNote: string | null;
  submitterId: string;
  submitterUsername: string | null;
};
