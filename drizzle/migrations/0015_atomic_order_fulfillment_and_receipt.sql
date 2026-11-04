ALTER TABLE public.orders ADD COLUMN fulfillment_state text NOT NULL DEFAULT 'pending', ADD COLUMN fulfillment_error text, ADD COLUMN buyer_received_at timestamptz, ADD COLUMN stars_refund_state text;
UPDATE public.orders SET fulfillment_state=CASE WHEN paid_at IS NULL THEN 'pending' WHEN delivered_content IS NOT NULL OR status IN ('shipped','delivered','completed','refunded') THEN 'ready' ELSE 'pending' END;
CREATE OR REPLACE FUNCTION public.fulfill_paid_order(_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; p public.products; ids uuid[]; claimed text; has_codes boolean;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND OR o.paid_at IS NULL OR o.escrow_status NOT IN ('holding','frozen') THEN RETURN false; END IF;
 IF o.fulfillment_state='ready' THEN RETURN true; END IF;
 SELECT * INTO p FROM public.products WHERE id=o.product_id FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM public.product_codes WHERE product_id=p.id) INTO has_codes;
 IF has_codes THEN
  SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.product_codes WHERE product_id=p.id AND status='available' ORDER BY created_at,id LIMIT o.quantity FOR UPDATE) picked;
  IF coalesce(cardinality(ids),0)<>o.quantity THEN
   UPDATE public.orders SET fulfillment_state='shortage',fulfillment_error='Not enough available codes',escrow_release_at=NULL,updated_at=now() WHERE id=o.id;
   UPDATE public.products SET stock=(SELECT count(*) FROM public.product_codes WHERE product_id=p.id AND status='available') WHERE id=p.id;
   RETURN false;
  END IF;
  UPDATE public.product_codes SET status='sold',order_id=o.id,sold_at=now() WHERE id=ANY(ids);
  SELECT string_agg(content,E'\n' ORDER BY created_at,id) INTO claimed FROM public.product_codes WHERE id=ANY(ids);
  UPDATE public.products SET stock=(SELECT count(*) FROM public.product_codes WHERE product_id=p.id AND status='available'),sold_count=sold_count+o.quantity WHERE id=p.id;
 ELSE
  IF p.stock<o.quantity THEN
   UPDATE public.orders SET fulfillment_state='shortage',fulfillment_error='Not enough stock',escrow_release_at=NULL,updated_at=now() WHERE id=o.id;
   RETURN false;
  END IF;
  UPDATE public.products SET stock=stock-o.quantity,sold_count=sold_count+o.quantity WHERE id=p.id;
 END IF;
 UPDATE public.orders SET fulfillment_state='ready',fulfillment_error=NULL,delivered_content=claimed,buyer_guide=p.buyer_guide,status=CASE WHEN has_codes THEN 'delivered' ELSE 'paid' END,escrow_release_at=CASE WHEN warranty_type='none' THEN now()+make_interval(days=>escrow_release_days) ELSE NULL END,updated_at=now() WHERE id=o.id;
 RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.fulfill_paid_order(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_paid_order(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid,_payment_id text,_pay_currency text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND OR o.status NOT IN ('awaiting_payment','expired') THEN RETURN false; END IF;
 UPDATE public.orders SET status='paid',escrow_status='holding',payment_status='finished',payment_id=_payment_id,pay_currency=_pay_currency,paid_at=now(),updated_at=now() WHERE id=o.id;
 PERFORM public.fulfill_paid_order(o.id);
 IF o.voucher_code IS NOT NULL THEN UPDATE public.vouchers SET used_count=used_count+1 WHERE shop_id=o.shop_id AND code=o.voucher_code; END IF;
 RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_order_escrow_release() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.escrow_status='released' AND OLD.escrow_status<>'released' AND OLD.fulfillment_state<>'ready' THEN RAISE EXCEPTION 'Order fulfillment is incomplete'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_order_escrow_release BEFORE UPDATE OF escrow_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_escrow_release();
CREATE OR REPLACE FUNCTION public.confirm_order_receipt(_actor uuid,_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND OR o.buyer_id<>_actor THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.buyer_received_at IS NOT NULL THEN RETURN true; END IF;
 IF o.fulfillment_state<>'ready' OR o.status NOT IN ('paid','shipped','delivered','completed') OR o.escrow_status NOT IN ('holding','released') THEN RAISE EXCEPTION 'Order cannot be received'; END IF;
 IF o.escrow_status='holding' AND NOT public.release_order_escrow(o.id) THEN RAISE EXCEPTION 'Escrow release failed'; END IF;
 UPDATE public.product_codes SET received_at=coalesce(received_at,now()) WHERE order_id=o.id AND status='sold';
 UPDATE public.orders SET buyer_received_at=now() WHERE id=o.id;
 RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.confirm_order_receipt(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_receipt(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.open_order_dispute(_actor uuid,_order_id uuid,_reason text,_note text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; result uuid;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND OR o.buyer_id<>_actor THEN RAISE EXCEPTION 'Order not found'; END IF;
 SELECT id INTO result FROM public.disputes WHERE order_id=o.id;
 IF result IS NOT NULL THEN RETURN result; END IF;
 IF o.escrow_status<>'holding' THEN RAISE EXCEPTION 'Funds are no longer held'; END IF;
 INSERT INTO public.disputes(order_id,opened_by,reason,buyer_note) VALUES(o.id,_actor,_reason,_note) RETURNING id INTO result;
 UPDATE public.orders SET status='disputed',escrow_status='frozen',updated_at=now() WHERE id=o.id;
 RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.open_order_dispute(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.open_order_dispute(uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.refund_order_escrow(_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF o.pay_method='stars' THEN RAISE EXCEPTION 'Stars refund must be processed through Telegram'; END IF;
 IF o.escrow_status NOT IN ('holding','frozen') THEN RETURN false; END IF;
 UPDATE public.orders SET escrow_status='refunded',status='refunded',updated_at=now() WHERE id=o.id;
 INSERT INTO public.wallet_transactions(user_id,type,amount,currency,order_id,description) VALUES(o.buyer_id,'refund',o.total_amount,o.currency,o.id,'Refund #'||o.order_number);
 UPDATE public.products SET stock=CASE WHEN EXISTS(SELECT 1 FROM public.product_codes WHERE product_id=o.product_id) THEN (SELECT count(*) FROM public.product_codes WHERE product_id=o.product_id AND status='available') WHEN o.fulfillment_state='ready' THEN stock+o.quantity ELSE stock END,sold_count=greatest(sold_count-CASE WHEN o.fulfillment_state='ready' THEN o.quantity ELSE 0 END,0) WHERE id=o.product_id;
 RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.refund_order_escrow(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refund_order_escrow(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.resolve_order_dispute(_actor uuid,_dispute uuid,_outcome text,_note text,_stars_refunded boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.disputes; o public.orders;
BEGIN
 IF NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO d FROM public.disputes WHERE id=_dispute;
 IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=d.order_id FOR UPDATE;
 SELECT * INTO d FROM public.disputes WHERE id=_dispute FOR UPDATE;
 IF d.status<>'open' THEN RETURN d.status=CASE WHEN _outcome='release' THEN 'resolved_release' ELSE 'resolved_refund' END; END IF;
 IF _outcome='release' THEN
  IF o.stars_refund_state IS NOT NULL THEN RAISE EXCEPTION 'Stars refund is in progress'; END IF;
  IF o.escrow_status<>'frozen' THEN RAISE EXCEPTION 'Escrow is not frozen'; END IF;
  UPDATE public.orders SET escrow_status='holding' WHERE id=o.id;
  IF NOT public.release_order_escrow(o.id) THEN RAISE EXCEPTION 'Escrow release failed'; END IF;
 ELSIF _outcome='refund' THEN
  IF o.pay_method='stars' THEN
   IF NOT _stars_refunded OR o.stars_refund_state<>'pending' OR o.escrow_status<>'frozen' THEN RAISE EXCEPTION 'Telegram refund is not confirmed'; END IF;
   UPDATE public.orders SET escrow_status='refunded',status='refunded',stars_refund_state='completed',updated_at=now() WHERE id=o.id;
   UPDATE public.products SET stock=CASE WHEN EXISTS(SELECT 1 FROM public.product_codes WHERE product_id=o.product_id) THEN (SELECT count(*) FROM public.product_codes WHERE product_id=o.product_id AND status='available') WHEN o.fulfillment_state='ready' THEN stock+o.quantity ELSE stock END,sold_count=greatest(sold_count-CASE WHEN o.fulfillment_state='ready' THEN o.quantity ELSE 0 END,0) WHERE id=o.product_id;
  ELSIF NOT public.refund_order_escrow(o.id) THEN RAISE EXCEPTION 'Refund failed'; END IF;
 ELSE RAISE EXCEPTION 'Invalid outcome'; END IF;
 UPDATE public.disputes SET status=CASE WHEN _outcome='release' THEN 'resolved_release' ELSE 'resolved_refund' END,admin_note=_note,resolved_at=now() WHERE id=d.id;
 RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_order_dispute(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_order_dispute(uuid,uuid,text,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.prepare_stars_refund(_actor uuid,_dispute uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.disputes; o public.orders; telegram text;
BEGIN
 IF NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO d FROM public.disputes WHERE id=_dispute;
 IF NOT FOUND OR d.status<>'open' THEN RAISE EXCEPTION 'Dispute not open'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=d.order_id FOR UPDATE;
 IF o.pay_method<>'stars' OR o.escrow_status<>'frozen' OR o.payment_id IS NULL THEN RAISE EXCEPTION 'Stars refund unavailable'; END IF;
 SELECT telegram_id INTO telegram FROM public.profiles WHERE id=o.buyer_id;
 IF telegram IS NULL OR telegram!~'^[0-9]+$' THEN RAISE EXCEPTION 'Telegram buyer not linked'; END IF;
 UPDATE public.orders SET stars_refund_state='pending' WHERE id=o.id;
 RETURN jsonb_build_object('telegramId',telegram,'paymentId',o.payment_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.prepare_stars_refund(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_stars_refund(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.my_reward_balance() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(sum(amount),0)::bigint FROM public.reward_points WHERE user_id=auth.uid() $$;
REVOKE EXECUTE ON FUNCTION public.my_reward_balance() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_reward_balance() TO authenticated;