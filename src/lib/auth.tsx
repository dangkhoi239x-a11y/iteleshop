import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { telegramLogin } from "@/functions/auth.functions";
import { inTelegram, tg } from "@/lib/telegram";
import i18n from "@/lib/i18n";
import { captureProductReferral } from '@/functions/referrals.functions';
import { parseProductRef } from '@/lib/product-referral';

type Profile = { id: string; telegram_id: string; username: string | null; first_name: string | null; last_name: string | null; photo_url: string | null; language: string; referral_code: string };

type AuthCtx = {
  session: Session | null;
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  isAdmin: boolean;
  shop: { id: string; name: string; status: string } | null;
  signingIn: boolean;
  loginError: string | null;
  loginTelegram: () => Promise<void>;
  loginDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const login = useServerFn(telegramLogin);
  const captureRef=useServerFn(captureProductReferral);
  const [captured,setCaptured]=useState<string|null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("ts_ref", ref);
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") qc.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setReady(true);
    });
    const w = tg();
    if (w?.initData) {
      w.ready();
      w.expand();
      w.setHeaderColor?.("#141a26");
      w.setBackgroundColor?.("#141a26");
    }
    return () => data.subscription.unsubscribe();
  }, [qc]);

  const finish = useCallback(async (p: Promise<{ access_token: string; refresh_token: string }>) => {
    setSigningIn(true);
    setLoginError(null);
    try {
      const tokens = await p;
      await supabase.auth.setSession(tokens);
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const loginTelegram = useCallback(
    () => {const initData=tg()?.initData;if(!initData)return Promise.resolve();return finish(login({ data: { initData, ref: localStorage.getItem("ts_ref") ?? undefined } }));},
    [finish, login],
  );
  const loginDemo = useCallback(() => {
    let id = localStorage.getItem("ts_demo_id");
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("") + Date.now().toString(36);
      localStorage.setItem("ts_demo_id", id);
    }
    return finish(login({ data: { demoId: id, ref: localStorage.getItem("ts_ref") ?? undefined } }));
  }, [finish, login]);

  // Inside Telegram: sign in automatically (or re-sign if a different Telegram account opened the app).
  useEffect(() => {
    if (ready && !session && inTelegram() && !signingIn && !loginError) void loginTelegram();
  }, [ready, session, signingIn, loginError, loginTelegram]);

  const userId = session?.user.id ?? null;
  useEffect(()=>{
    const w=tg();const start=w?.initDataUnsafe?.start_param;
    if(!userId||!w?.initData||!parseProductRef(start)||captured===userId)return;
    setCaptured(userId);
    void captureRef({data:{initData:w.initData}}).then(r=>{if(r.productId)window.location.assign(`/product/${r.productId}`)}).catch(()=>setLoginError('Link giới thiệu không đủ điều kiện.'));
  },[userId,captured,captureRef]);
  const { data: me } = useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      if(!userId)return {profile:null,isAdmin:false,shop:null};
      const [p, r, s] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("shops").select("id, name, status").eq("owner_id", userId).maybeSingle(),
      ]);
      return { profile: p.data as Profile | null, isAdmin: !!r.data?.some((x) => x.role === "admin"), shop: s.data };
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem("ts_lang");
    const lang = me?.profile?.language ?? saved;
    if (lang && i18n.language !== lang) void i18n.changeLanguage(lang);
  }, [me?.profile?.language]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider
      value={{ session, ready, userId, profile: me?.profile ?? null, isAdmin: !!me?.isAdmin, shop: me?.shop ?? null, signingIn, loginError, loginTelegram, loginDemo, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
