import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getRecommendations = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ need: z.string().trim().min(5).max(1500), language: z.enum(["vi","en","ru","zh"]), shopId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { recommendProducts } = await import("@/server/recommendations.server");
    return recommendProducts(getRequest(), db, data.need, data.language, data.shopId);
  });