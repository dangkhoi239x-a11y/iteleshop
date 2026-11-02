CREATE TABLE public.growth_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES public.shops(id), created_by uuid NOT NULL, title text NOT NULL CHECK(length(title) BETWEEN 3 AND 120), rules text NOT NULL CHECK(length(rules) BETWEEN 10 AND 4000), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','paused')), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, max_entries integer NOT NULL DEFAULT 5 CHECK(max_entries BETWEEN 1 AND 100), referral_entries integer NOT NULL DEFAULT 1 CHECK(referral_entries BETWEEN 1 AND 10), created_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_at>starts_at)
);
GRANT SELECT ON public.growth_campaigns TO authenticated;
GRANT ALL ON public.growth_campaigns TO service_role;
ALTER TABLE public.growth_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "growth visible" ON public.growth_campaigns FOR SELECT TO authenticated USING(status='active' OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.shops s WHERE s.id=shop_id AND s.owner_id=auth.uid()));
CREATE TABLE public.growth_prizes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.growth_campaigns(id), label text NOT NULL CHECK(length(label) BETWEEN 1 AND 100), position integer NOT NULL, UNIQUE(campaign_id,position));
GRANT SELECT ON public.growth_prizes TO authenticated;
GRANT ALL ON public.growth_prizes TO service_role;
ALTER TABLE public.growth_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visible prizes" ON public.growth_prizes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.growth_campaigns c WHERE c.id=campaign_id));
CREATE TABLE public.growth_prize_secrets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), prize_id uuid NOT NULL REFERENCES public.growth_prizes(id), content text NOT NULL CHECK(length(content) BETWEEN 1 AND 4000), awarded_to uuid, awarded_at timestamptz, UNIQUE(prize_id,content));
GRANT ALL ON public.growth_prize_secrets TO service_role;
ALTER TABLE public.growth_prize_secrets ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.growth_members (campaign_id uuid NOT NULL REFERENCES public.growth_campaigns(id), user_id uuid NOT NULL REFERENCES public.profiles(id), invite_code uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, referrer_id uuid, entries integer NOT NULL DEFAULT 1, used_entries integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(campaign_id,user_id), CHECK(entries>=used_entries AND used_entries>=0));
GRANT SELECT ON public.growth_members TO authenticated;
GRANT ALL ON public.growth_members TO service_role;
ALTER TABLE public.growth_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own growth membership" ON public.growth_members FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.growth_campaigns c JOIN public.shops s ON s.id=c.shop_id WHERE c.id=campaign_id AND s.owner_id=auth.uid()));
CREATE TABLE public.growth_spins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.growth_campaigns(id), user_id uuid NOT NULL, request_id uuid NOT NULL, prize_id uuid NOT NULL REFERENCES public.growth_prizes(id), delivered_content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,request_id));
GRANT SELECT ON public.growth_spins TO authenticated;
GRANT ALL ON public.growth_spins TO service_role;
ALTER TABLE public.growth_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prize delivery" ON public.growth_spins FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.growth_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.growth_campaigns(id), actor_id uuid NOT NULL, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.growth_events TO authenticated;
GRANT ALL ON public.growth_events TO service_role;
ALTER TABLE public.growth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager growth events" ON public.growth_events FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.growth_campaigns c JOIN public.shops s ON s.id=c.shop_id WHERE c.id=campaign_id AND s.owner_id=auth.uid()));
CREATE FUNCTION public.create_growth_campaign(_actor uuid, _shop uuid, _title text, _rules text, _starts timestamptz, _ends timestamptz, _max integer, _bonus integer, _prizes jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid; pid uuid; p jsonb; code text; n integer:=0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM shops WHERE id=_shop AND owner_id=_actor AND status='active') AND NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _ends<=now() OR jsonb_array_length(_prizes)<2 OR jsonb_array_length(_prizes)>8 THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
 INSERT INTO growth_campaigns(shop_id,created_by,title,rules,starts_at,ends_at,max_entries,referral_entries) VALUES(_shop,_actor,_title,_rules,_starts,_ends,_max,_bonus) RETURNING id INTO cid;
 FOR p IN SELECT value FROM jsonb_array_elements(_prizes) LOOP
 IF jsonb_array_length(p->'codes')<1 OR jsonb_array_length(p->'codes')>500 THEN RAISE EXCEPTION 'Invalid prize inventory'; END IF;
 INSERT INTO growth_prizes(campaign_id,label,position) VALUES(cid,p->>'label',n) RETURNING id INTO pid;
 FOR code IN SELECT value FROM jsonb_array_elements_text(p->'codes') LOOP INSERT INTO growth_prize_secrets(prize_id,content) VALUES(pid,code); END LOOP;
 n:=n+1;
 END LOOP;
 INSERT INTO growth_events(campaign_id,actor_id,event) VALUES(cid,_actor,'created'); RETURN cid;
END $$;
CREATE FUNCTION public.set_growth_status(_actor uuid, _campaign uuid, _status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c growth_campaigns;
BEGIN
 SELECT * INTO c FROM growth_campaigns WHERE id=_campaign FOR UPDATE;
 IF c.id IS NULL OR _status NOT IN ('active','paused') THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
 IF NOT public.has_role(_actor,'admin') THEN
 IF _status<>'paused' OR NOT EXISTS(SELECT 1 FROM shops WHERE id=c.shop_id AND owner_id=_actor) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 END IF;
 UPDATE growth_campaigns SET status=_status WHERE id=_campaign;
 INSERT INTO growth_events(campaign_id,actor_id,event) VALUES(_campaign,_actor,_status);
END $$;
CREATE FUNCTION public.join_growth_campaign(_user uuid, _campaign uuid, _invite uuid DEFAULT NULL, _new_telegram boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c growth_campaigns; inviter uuid; owner uuid;
BEGIN
 SELECT * INTO c FROM growth_campaigns WHERE id=_campaign FOR UPDATE;
 IF c.id IS NULL OR c.status<>'active' OR now()<c.starts_at OR now()>=c.ends_at THEN RAISE EXCEPTION 'Campaign not open'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=_user AND telegram_id ~ '^[0-9]+$') THEN RAISE EXCEPTION 'Open in Telegram to participate'; END IF;
 IF EXISTS(SELECT 1 FROM growth_members WHERE campaign_id=_campaign AND user_id=_user) THEN RETURN; END IF;
 SELECT owner_id INTO owner FROM shops WHERE id=c.shop_id AND status='active';
 IF owner IS NULL OR owner=_user THEN RAISE EXCEPTION 'Shop owner cannot participate'; END IF;
 IF _new_telegram AND _invite IS NOT NULL THEN
 SELECT user_id INTO inviter FROM growth_members WHERE campaign_id=_campaign AND invite_code=_invite AND user_id<>_user AND user_id<>owner;
 END IF;
 INSERT INTO growth_members(campaign_id,user_id,referrer_id) VALUES(_campaign,_user,inviter);
 IF inviter IS NOT NULL THEN UPDATE growth_members SET entries=least(c.max_entries,entries+c.referral_entries) WHERE campaign_id=_campaign AND user_id=inviter; END IF;
 INSERT INTO growth_events(campaign_id,actor_id,event) VALUES(_campaign,_user,CASE WHEN inviter IS NULL THEN 'joined' ELSE 'referred_new_telegram' END);
END $$;
CREATE FUNCTION public.spin_growth_campaign(_user uuid, _campaign uuid, _request uuid, _random double precision) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c growth_campaigns; m growth_members; sid uuid; gift growth_prize_secrets; n integer; off integer;
BEGIN
 SELECT * INTO c FROM growth_campaigns WHERE id=_campaign FOR UPDATE;
 SELECT id INTO sid FROM growth_spins WHERE user_id=_user AND request_id=_request AND campaign_id=_campaign;
 IF sid IS NOT NULL THEN RETURN sid; END IF;
 IF c.id IS NULL OR c.status<>'active' OR now()<c.starts_at OR now()>=c.ends_at OR _random<0 OR _random>=1 OR _random IS NULL THEN RAISE EXCEPTION 'Campaign not open'; END IF;
 IF NOT EXISTS(SELECT 1 FROM shops WHERE id=c.shop_id AND status='active') THEN RAISE EXCEPTION 'Shop unavailable'; END IF;
 SELECT * INTO m FROM growth_members WHERE campaign_id=_campaign AND user_id=_user FOR UPDATE;
 IF m.user_id IS NULL OR m.used_entries>=m.entries THEN RAISE EXCEPTION 'No entries remaining'; END IF;
 SELECT count(*) INTO n FROM growth_prize_secrets s JOIN growth_prizes p ON p.id=s.prize_id WHERE p.campaign_id=_campaign AND s.awarded_to IS NULL;
 IF n=0 THEN RAISE EXCEPTION 'Prize pool exhausted'; END IF;
 off:=floor(_random*n);
 SELECT s.* INTO gift FROM growth_prize_secrets s JOIN growth_prizes p ON p.id=s.prize_id WHERE p.campaign_id=_campaign AND s.awarded_to IS NULL ORDER BY s.id OFFSET off LIMIT 1 FOR UPDATE OF s;
 UPDATE growth_prize_secrets SET awarded_to=_user,awarded_at=now() WHERE id=gift.id;
 UPDATE growth_members SET used_entries=used_entries+1 WHERE campaign_id=_campaign AND user_id=_user;
 INSERT INTO growth_spins(campaign_id,user_id,request_id,prize_id,delivered_content) VALUES(_campaign,_user,_request,gift.prize_id,gift.content) RETURNING id INTO sid;
 INSERT INTO growth_events(campaign_id,actor_id,event) VALUES(_campaign,_user,'prize_delivered'); RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.create_growth_campaign(uuid,uuid,text,text,timestamptz,timestamptz,integer,integer,jsonb),public.set_growth_status(uuid,uuid,text),public.join_growth_campaign(uuid,uuid,uuid,boolean),public.spin_growth_campaign(uuid,uuid,uuid,double precision) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_growth_campaign(uuid,uuid,text,text,timestamptz,timestamptz,integer,integer,jsonb),public.set_growth_status(uuid,uuid,text),public.join_growth_campaign(uuid,uuid,uuid,boolean),public.spin_growth_campaign(uuid,uuid,uuid,double precision) TO service_role;