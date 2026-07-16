import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createProjectWorkspace(input: {
  projectId: string;
  requestId: string;
  expectedCurrentRevisionId: string;
}) {
  const db = await createSupabaseServerClient();
  return db.rpc("create_project_workspace", {
    p_project_id: input.projectId,
    p_request_id: input.requestId,
    p_expected_current_revision_id: input.expectedCurrentRevisionId,
  });
}
