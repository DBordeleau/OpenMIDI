export const edgeCorsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
} as const;

export function edgeCorsPreflightResponse() {
  return new Response("ok", { headers: edgeCorsHeaders });
}
