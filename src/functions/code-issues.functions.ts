import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reportCodeSchema, resolveCodeSchema } from "@/lib/code-issue-schema";

export const reportCodeIssue = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => reportCodeSchema.parse(i)).handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const r = await db.rpc("report_code_issue", { _actor: context.userId, _order: data.orderId, _code: data.codeId, _description: data.description });
    if (r.error) throw new Error(r.error.code === "23505" ? "This code already has an open report" : r.error.message);
    return { ok: true };
  });
export const resolveCodeIssue = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => resolveCodeSchema.parse(i)).handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const r = await db.rpc("resolve_code_issue", { _actor: context.userId, _issue: data.issueId, _action: data.action, _note: data.note });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });