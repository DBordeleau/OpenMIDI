import { beforeEach, describe, expect, it, vi } from "vitest";

const tables = vi.hoisted(() => [] as string[]);
const id = "10000000-0000-4000-8000-000000000001";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      tables.push(table);
      const response =
        table === "public_project_catalog"
          ? {
              data: {
                project_id: id,
                title: "Public source",
                description: null,
                license_code: "cc-by-4.0",
              },
              error: null,
            }
          : table === "project_revisions"
            ? {
                data: {
                  id,
                  project_id: id,
                  revision_number: 2,
                  duration_ms: 4000,
                  arrangement_version_id: id,
                },
                error: null,
              }
            : table === "licenses"
              ? {
                  data: {
                    code: "cc-by-4.0",
                    name: "CC BY 4.0",
                    url: "https://creativecommons.org/licenses/by/4.0/",
                    summary: "Reuse with attribution.",
                    allows_derivatives: true,
                    requires_attribution: true,
                    share_alike: false,
                  },
                  error: null,
                }
              : { data: null, count: 2, error: null };
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => response,
        then: (resolve: (value: typeof response) => unknown) =>
          Promise.resolve(resolve(response)),
      };
      return query;
    },
  }),
}));

import { getForkSourceForViewer } from "./forks";

describe("public fork source", () => {
  beforeEach(() => {
    tables.length = 0;
  });

  it("loads public source metadata without requiring project membership", async () => {
    await expect(
      getForkSourceForViewer({ projectId: id, revisionId: id }),
    ).resolves.toMatchObject({
      projectId: id,
      projectTitle: "Public source",
      revisionNumber: 2,
      trackCount: 2,
    });
    expect(tables).toContain("public_project_catalog");
    expect(tables).not.toContain("projects");
  });
});
