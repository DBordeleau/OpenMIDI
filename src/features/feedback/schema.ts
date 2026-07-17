import { z } from "zod";

export const feedbackKindSchema = z.enum(["bug", "suggestion"]);
export const feedbackStatusSchema = z.enum(["new", "handled"]);

const safePathnameSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("?") &&
      !value.includes("#") &&
      !value.includes("\\") &&
      !/[\u0000-\u001f\u007f]/u.test(value),
    "Use an application pathname without a query or fragment.",
  );

export const feedbackSubmissionSchema = z
  .object({
    requestId: z.uuid(),
    kind: feedbackKindSchema,
    summary: z.string().trim().min(5).max(120),
    details: z.string().trim().min(20).max(4000),
    sourcePathname: safePathnameSchema,
    includeBrowserContext: z.boolean(),
    browserContext: z.string().trim().max(300),
  })
  .superRefine((value, context) => {
    if (value.includeBrowserContext && value.browserContext.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["browserContext"],
        message: "Add the browser context you want to share.",
      });
    }
    if (!value.includeBrowserContext && value.browserContext.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["browserContext"],
        message: "Opt in before sharing browser context.",
      });
    }
  });

export const adminFeedbackFilterSchema = z.object({
  status: z.union([feedbackStatusSchema, z.literal("all")]).default("all"),
  kind: z.union([feedbackKindSchema, z.literal("all")]).default("all"),
  after: z.string().max(512).optional(),
  updated: z.enum(["1"]).optional(),
});

export const adminFeedbackActionSchema = z
  .object({
    feedbackId: z.uuid(),
    requestId: z.uuid(),
    action: z.enum(["classify", "handle", "reopen", "delete"]),
    expectedLockVersion: z.coerce.number().int().positive(),
    kind: feedbackKindSchema.optional(),
    note: z
      .string()
      .trim()
      .max(1000)
      .transform((value) => value || null),
    deletionReason: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || null),
    confirmDelete: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.action === "classify" && !value.kind) {
      context.addIssue({
        code: "custom",
        path: ["kind"],
        message: "Choose a classification.",
      });
    }
    if (value.action === "delete") {
      if (!value.confirmDelete) {
        context.addIssue({
          code: "custom",
          path: ["confirmDelete"],
          message: "Confirm permanent deletion.",
        });
      }
      if (!value.deletionReason || value.deletionReason.length < 5) {
        context.addIssue({
          code: "custom",
          path: ["deletionReason"],
          message: "Add a deletion reason.",
        });
      }
    }
  });

export function formCheckbox(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

export function sanitizeFeedbackPathname(value: string | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/feedback";
  }
  try {
    const parsed = new URL(value, "https://openmidi.invalid");
    if (parsed.origin !== "https://openmidi.invalid") return "/feedback";
    const pathname = parsed.pathname.slice(0, 300);
    return safePathnameSchema.safeParse(pathname).success
      ? pathname
      : "/feedback";
  } catch {
    return "/feedback";
  }
}
