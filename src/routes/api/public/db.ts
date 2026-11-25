import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/db")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env["DATABASE_URL"]) {
          return Response.json({ data: null, error: { message: "DATABASE_URL is not configured" } }, { status: 500 });
        }
        const { executePgQuery, executePgRpc, verifyJwt } = await import("@/server/pg-adapter.server");
        const body = (await request.json().catch(() => null)) as
          | { kind: "query"; payload: Parameters<typeof executePgQuery>[0] }
          | { kind: "rpc"; fn: string; args?: Record<string, unknown> }
          | null;

        if (!body) return Response.json({ data: null, error: { message: "Invalid request" } }, { status: 400 });

        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
        const claims = token ? verifyJwt(token) : null;
        const role = claims ? "authenticated" : "anon";
        const userId = claims?.sub ?? null;

        if (body.kind === "query") {
          const res = await executePgQuery(body.payload, role, userId);
          return Response.json(res);
        }
        if (body.kind === "rpc") {
          const res = await executePgRpc(body.fn, body.args, role, userId);
          return Response.json(res);
        }
        return Response.json({ data: null, error: { message: "Unknown action" } }, { status: 400 });
      },
    },
  },
});
