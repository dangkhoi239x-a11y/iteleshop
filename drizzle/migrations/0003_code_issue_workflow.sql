CREATE TABLE public.code_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id), code_id uuid NOT NULL REFERENCES public.product_codes(id), buyer_id uuid NOT NULL,
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 2000), status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','replaced','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.code_issues TO authenticated;
GRANT ALL ON public.code_issues TO service_role;
ALTER TABLE public.code_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order participants read code issues" ON public.code_issues FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.shops s ON s.id=o.shop_id WHERE o.id=order_id AND (o.buyer_id=auth.uid() OR s.owner_id=auth.uid())));
CREATE UNIQUE INDEX code_issues_one_active ON public.code_issues(code_id) WHERE status IN ('open','reviewing');
CREATE TABLE public.code_issue_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), issue_id uuid NOT NULL REFERENCES public.code_issues(id), order_id uuid NOT NULL REFERENCES public.orders(id), actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('reported','reviewing','replaced','rejected')), note text NOT NULL, old_content text, new_content text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.code_issue_events TO authenticated;
GRANT ALL ON public.code_issue_events TO service_role;
ALTER TABLE public.code_issue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order participants read code history" ON public.code_issue_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.shops s ON s.id=o.shop_id WHERE o.id=order_id AND (o.buyer_id=auth.uid() OR s.owner_id=auth.uid())));
CREATE INDEX code_issue_events_order ON public.code_issue_events(order_id,created_at);
CREATE FUNCTION public.report_code_issue(_actor uuid,_order uuid,_code uuid,_description text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; c public.product_codes; issue uuid;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order FOR UPDATE;
 IF NOT FOUND OR o.buyer_id<>_actor THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.delivered_content IS NULL OR o.status NOT IN ('paid','shipped','delivered','completed','disputed') THEN RAISE EXCEPTION 'No eligible digital delivery'; END IF;
 SELECT * INTO c FROM public.product_codes WHERE id=_code AND order_id=o.id AND status='sold' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Code is not an active delivery for this order'; END IF;
 INSERT INTO public.code_issues(order_id,code_id,buyer_id,description) VALUES(o.id,c.id,_actor,trim(_description)) RETURNING id INTO issue;
 INSERT INTO public.code_issue_events(issue_id,order_id,actor_id,action,note,old_content) VALUES(issue,o.id,_actor,'reported',trim(_description),c.content);
 RETURN issue;
END $$;
CREATE FUNCTION public.resolve_code_issue(_actor uuid,_issue uuid,_action text,_note text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.code_issues; o public.orders; oldcode public.product_codes; newcode public.product_codes; oid uuid;
BEGIN
 SELECT order_id INTO oid FROM public.code_issues WHERE id=_issue;
 SELECT * INTO o FROM public.orders WHERE id=oid FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.shops WHERE id=o.shop_id AND owner_id=_actor) THEN RAISE EXCEPTION 'Not allowed'; END IF;
 SELECT * INTO i FROM public.code_issues WHERE id=_issue FOR UPDATE;
 IF i.status NOT IN ('open','reviewing') THEN RAISE EXCEPTION 'Report already resolved'; END IF;
 IF _action NOT IN ('reviewing','replaced','rejected') OR length(trim(_note)) NOT BETWEEN 2 AND 2000 THEN RAISE EXCEPTION 'Invalid response'; END IF;
 IF _action='reviewing' AND i.status='reviewing' THEN RAISE EXCEPTION 'Already under review'; END IF;
 IF _action='replaced' THEN
   IF o.status IN ('refunded','cancelled','expired','awaiting_payment') THEN RAISE EXCEPTION 'Order cannot receive a replacement'; END IF;
   SELECT * INTO oldcode FROM public.product_codes WHERE id=i.code_id AND order_id=o.id AND status='sold' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Code is no longer active'; END IF;
   SELECT * INTO newcode FROM public.product_codes WHERE product_id=o.product_id AND status='available' AND content<>oldcode.content ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
   IF NOT FOUND THEN RAISE EXCEPTION 'No replacement codes available. Add codes to the product first.'; END IF;
   UPDATE public.product_codes SET status='disabled' WHERE id=oldcode.id;
   UPDATE public.product_codes SET status='sold',order_id=o.id,sold_at=now() WHERE id=newcode.id;
   UPDATE public.orders SET delivered_content=(SELECT string_agg(content,E'\n' ORDER BY sold_at,id) FROM public.product_codes WHERE order_id=o.id AND status='sold'),updated_at=now() WHERE id=o.id;
   UPDATE public.products SET stock=(SELECT count(*) FROM public.product_codes WHERE product_id=o.product_id AND status='available') WHERE id=o.product_id;
 END IF;
 UPDATE public.code_issues SET status=_action,updated_at=now() WHERE id=i.id;
 INSERT INTO public.code_issue_events(issue_id,order_id,actor_id,action,note,old_content,new_content) VALUES(i.id,o.id,_actor,_action,trim(_note),oldcode.content,newcode.content);
 RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.report_code_issue(uuid,uuid,uuid,text),public.resolve_code_issue(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_code_issue(uuid,uuid,uuid,text),public.resolve_code_issue(uuid,uuid,text,text) TO service_role;
CREATE TABLE public.ai_access_state (id text PRIMARY KEY, blocked_message text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.ai_access_state TO service_role;
ALTER TABLE public.ai_access_state ENABLE ROW LEVEL SECURITY;