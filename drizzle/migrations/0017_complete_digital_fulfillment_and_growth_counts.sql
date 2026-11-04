CREATE OR REPLACE FUNCTION public.fulfill_paid_order(_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; p public.products; ids uuid[]; claimed text; has_codes boolean;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND OR o.paid_at IS NULL OR o.escrow_status NOT IN ('holding','frozen') THEN RETURN false; END IF;
 IF o.fulfillment_state='ready' THEN RETURN true; END IF;
 SELECT * INTO p FROM public.products WHERE id=o.product_id FOR UPDATE;
 SELECT p.goods_kind='digital' OR EXISTS(SELECT 1 FROM public.product_codes WHERE product_id=p.id) INTO has_codes;
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
CREATE OR REPLACE FUNCTION public.growth_inventory_counts(_campaigns uuid[]) RETURNS TABLE(prize_id uuid,remaining bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,count(s.id) FILTER(WHERE s.awarded_to IS NULL) FROM public.growth_prizes p LEFT JOIN public.growth_prize_secrets s ON s.prize_id=p.id WHERE p.campaign_id=ANY(_campaigns) GROUP BY p.id
$$;
REVOKE EXECUTE ON FUNCTION public.growth_inventory_counts(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.growth_inventory_counts(uuid[]) TO service_role;
CREATE OR REPLACE FUNCTION public.growth_member_counts(_campaigns uuid[]) RETURNS TABLE(campaign_id uuid,users bigint,referrals bigint,spins bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT m.campaign_id,count(*),count(*) FILTER(WHERE referrer_id IS NOT NULL),coalesce(sum(used_entries),0)::bigint FROM public.growth_members m WHERE m.campaign_id=ANY(_campaigns) GROUP BY m.campaign_id
$$;
REVOKE EXECUTE ON FUNCTION public.growth_member_counts(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.growth_member_counts(uuid[]) TO service_role;