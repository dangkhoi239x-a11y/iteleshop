import { checked, readAll, readWindow } from "./data-result";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Res = { data: unknown; error: { message: string } | null };
const must = <R extends Res>(r: R) => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<R["data"]>;
};
const maybe = <R extends Res>(r: R) => {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? null) as R["data"] | null;
};

const PRODUCT_COLS = "*, shops(id, name, logo_url)";

export const productsQuery = (search = "", category = "", pages = 1) =>
  queryOptions({
    queryKey: ["products", search, category, pages],
    queryFn: async () => {
      let q = supabase.from("products").select(PRODUCT_COLS).eq("status", "active").order("sold_count", { ascending: false }).order("created_at", { ascending: false }).order("id").range(0, pages * 60 - 1);
      if (search) q = q.ilike("name", `%${search.replace(/[%_,()]/g, "")}%`);
      if (category) q = q.eq("category", category);
      return readWindow((a,b)=>q.range(a,b),pages*60,60);
    },
  });

export const flashQuery = (pages=1) =>
  queryOptions({
    queryKey: ["flash",pages],
    queryFn: async () =>
      readWindow((a,b)=>supabase.from("products").select(PRODUCT_COLS).eq("status", "active").not("flash_sale_price", "is", null).gt("flash_sale_end", new Date().toISOString()).order("flash_sale_end").order("id").range(a,b),pages*20),
  });

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ["product", id],
    queryFn: async () => maybe(await supabase.from("products").select("*, shops(id, name, logo_url, owner_id, rating, total_sales)").eq("id", id).maybeSingle()),
  });

export const shopsQuery = (search = "", pages = 1) =>
  queryOptions({ queryKey: ["shops", search, pages], queryFn: async () => { let q = supabase.from("shops").select("*").eq("status", "active").order("total_sales", { ascending: false }).order("id"); if(search) q=q.ilike("name", `%${search.replace(/[%_,()]/g, "")}%`); return readWindow((a,b)=>q.range(a,b),pages*100); } });

export const shopQuery = (id: string) =>
  queryOptions({
    queryKey: ["shop", id],
    queryFn: async () => {
      const shop = maybe(await supabase.from("shops").select("*").eq("id", id).maybeSingle());
      const products = must(await supabase.from("products").select("*").eq("shop_id", id).eq("status", "active").order("created_at", { ascending: false }));
      return { shop, products };
    },
  });

export const myProductsQuery = (shopId: string) =>
  queryOptions({ queryKey: ["myProducts", shopId], queryFn: async () => must(await supabase.from("products").select("*").eq("shop_id", shopId).neq("status", "archived").order("created_at", { ascending: false })) });

export const myShopQuery = (userId: string) =>
  queryOptions({
    queryKey: ["myShop", userId],
    queryFn: async () => {
      const shop = maybe(await supabase.from("shops").select("*").eq("owner_id", userId).maybeSingle());
      const bot = shop ? maybe(await supabase.from("shop_bots").select("*").eq("shop_id", shop.id).maybeSingle()) : null;
      return { shop, bot };
    },
  });

export const myOrdersQuery = (userId: string) =>
  queryOptions({ queryKey: ["myOrders", userId], queryFn: async () => must(await supabase.from("orders").select("*").eq("buyer_id", userId).order("created_at", { ascending: false })) });

export const shopOrdersQuery = (shopId: string) =>
  queryOptions({ queryKey: ["shopOrders", shopId], queryFn: async () => must(await supabase.from("orders").select("*").eq("shop_id", shopId).neq("status", "awaiting_payment").neq("status", "cancelled").order("created_at", { ascending: false })) });

export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ["order", id],
    queryFn: async () => {
      const order = maybe(await supabase.from("orders").select("*, shops(id, name, owner_id)").eq("id", id).maybeSingle());
      const dispute = order ? maybe(await supabase.from("disputes").select("*").eq("order_id", id).maybeSingle()) : null;
      return { order, dispute };
    },
  });

export const vouchersQuery = (shopId: string) =>
  queryOptions({ queryKey: ["vouchers", shopId], queryFn: async () => must(await supabase.from("vouchers").select("*").eq("shop_id", shopId).order("created_at", { ascending: false })) });

export const affiliateQuery = (userId: string) =>
  queryOptions({ queryKey: ["affiliate", userId], queryFn: async () => maybe(await supabase.from("affiliates").select("*").eq("user_id", userId).maybeSingle()) });

export const tiersQuery = () =>
  queryOptions({ queryKey: ["tiers"], queryFn: async () => must(await supabase.from("commission_tiers").select("*").order("min_order_amount")) });

export const rewardsQuery = (shopId?: string) =>
  queryOptions({
    queryKey: ["rewards", shopId ?? "all"],
    queryFn: async () => {
      let tq = supabase.from("reward_tasks").select("*, shops(name)").eq("is_active", true).order("created_at", { ascending: false });
      let dq = supabase.from("lucky_draws").select("*, shops(name), draw_winners(display_name, rank)").neq("status", "cancelled").order("ends_at", { ascending: false }).limit(30);
      if (shopId) { tq = tq.eq("shop_id", shopId); dq = dq.eq("shop_id", shopId); }
      return { tasks: must(await tq), draws: must(await dq) };
    },
  });

export const myRewardsQuery = (userId: string,pages=1) =>
  queryOptions({
    queryKey: ["myRewards", userId,pages],
    queryFn: async () => {
      const [pts, ck, done, ent, balance] = await Promise.all([
        readWindow((a,b)=>supabase.from("reward_points").select("amount, source, note, created_at").eq("user_id", userId).order("created_at", { ascending: false }).order("id").range(a,b),pages*20),
        supabase.from("checkins").select("day, streak").eq("user_id", userId).order("day", { ascending: false }).limit(1),
        supabase.from("task_completions").select("task_id").eq("user_id", userId),
        supabase.from("draw_entries").select("draw_id").eq("user_id", userId),
        supabase.rpc("my_reward_balance"),
      ]);
      return { balance: Number(checked(balance)), points: pts, lastCheckin: must(ck)[0] ?? null, done: must(done).map((d) => d.task_id), entries: must(ent).map((e) => e.draw_id) };
    },
  });

export const managedRewardsQuery = (shopId: string | null) =>
  queryOptions({
    queryKey: ["managedRewards", shopId ?? "platform"],
    queryFn: async () => {
      let tq = supabase.from("reward_tasks").select("*").order("created_at", { ascending: false });
      let dq = supabase.from("lucky_draws").select("*, draw_winners(display_name, rank)").order("created_at", { ascending: false });
      tq = shopId ? tq.eq("shop_id", shopId) : tq.is("shop_id", null);
      dq = shopId ? dq.eq("shop_id", shopId) : dq.is("shop_id", null);
      return { tasks: must(await tq), draws: must(await dq) };
    },
  });

export const platformSettingsQuery = () => queryOptions({ queryKey: ["platformSettings"], queryFn: async () => checked(await supabase.from("platform_settings").select("*").single()) });
