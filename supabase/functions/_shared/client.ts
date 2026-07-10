// Builds a Supabase client scoped to the calling user's JWT, so Row Level
// Security policies apply exactly as they would for a direct client call.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export function userClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

export function getUserIdOrThrow(req: Request): Promise<string> {
  const supabase = userClient(req);
  return supabase.auth.getUser().then(({ data, error }) => {
    if (error || !data.user) throw new Error("Not authenticated");
    return data.user.id;
  });
}
