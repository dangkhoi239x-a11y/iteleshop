CREATE TABLE public.stars_settlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), currency text NOT NULL CHECK(currency IN ('USDT','TON')), received_amount numeric(18,6) NOT NULL CHECK(received_amount > 0), stars_amount bigint NOT NULL CHECK(stars_amount > 0), reference text NOT NULL UNIQUE, confirmed_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stars_settlements TO authenticated;
GRANT ALL ON public.stars_settlements TO service_role;
ALTER TABLE public.stars_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin settlement reads" ON public.stars_settlements FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
ALTER TABLE public.orders ADD COLUMN stars_settlement_id uuid REFERENCES public.stars_settlements(id), ADD COLUMN settled_amount numeric(18,6), ADD COLUMN settled_currency text, ADD COLUMN settled_fee numeric(18,6), ADD COLUMN settled_affiliate numeric(18,6), ADD COLUMN settled_net numeric(18,6), ADD COLUMN settled_at timestamptz;
CREATE INDEX ON public.orders(paid_at,shop_id,pay_method);
CREATE OR REPLACE FUNCTION public.credit_stars_order(_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; seller uuid;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF o.pay_method <> 'stars' OR o.escrow_status <> 'released' OR o.stars_settlement_id IS NULL THEN RETURN false; END IF;
 SELECT owner_id INTO seller FROM public.shops WHERE id=o.shop_id;
 INSERT INTO public.wallet_transactions(user_id,type,amount,currency,order_id,description) VALUES(seller,'sale',o.settled_net,o.settled_currency,o.id,'Stars actual settlement #'||o.order_number) ON CONFLICT DO NOTHING;
 IF o.settled_affiliate > 0 AND o.affiliate_user_id IS NOT NULL THEN
 INSERT INTO public.wallet_transactions(user_id,type,amount,currency,order_id,description) VALUES(o.affiliate_user_id,'commission',o.settled_affiliate,o.settled_currency,o.id,'Stars affiliate #'||o.order_number) ON CONFLICT DO NOTHING;
 END IF;
 RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.credit_stars_order(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.credit_stars_order(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.settle_stars_orders(_actor uuid,_orders uuid[],_amount numeric,_currency text,_reference text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE batch uuid; total_stars bigint; cnt integer; o public.orders; allocated numeric:=0; gross numeric; fee numeric; aff numeric; pos integer:=0;
BEGIN
 IF NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _currency NOT IN ('USDT','TON') OR _amount <= 0 OR _amount <> round(_amount,6) OR length(trim(_reference)) < 6 OR coalesce(cardinality(_orders),0)=0 THEN RAISE EXCEPTION 'Invalid settlement'; END IF;
 PERFORM id FROM public.orders WHERE id=ANY(_orders) ORDER BY id FOR UPDATE;
 SELECT count(*),sum(stars_amount) INTO cnt,total_stars FROM public.orders WHERE id=ANY(_orders) AND pay_method='stars' AND stars_settlement_id IS NULL AND stars_amount>0 AND escrow_status IN ('holding','frozen','released');
 IF cnt<>cardinality(_orders) THEN RAISE EXCEPTION 'Orders already settled, unpaid or refunded'; END IF;
 INSERT INTO public.stars_settlements(currency,received_amount,stars_amount,reference,confirmed_by) VALUES(_currency,_amount,total_stars,trim(_reference),_actor) RETURNING id INTO batch;
 FOR o IN SELECT * FROM public.orders WHERE id=ANY(_orders) ORDER BY id LOOP
 pos:=pos+1;
 gross:=CASE WHEN pos=cnt THEN _amount-allocated ELSE trunc(_amount*o.stars_amount/total_stars,6) END;
 allocated:=allocated+gross;
 fee:=round(gross*o.commission_percent/100,6);
 aff:=CASE WHEN o.affiliate_user_id IS NULL THEN 0 ELSE round(gross*o.affiliate_percent/100,6) END;
 IF gross-fee-aff<0 THEN RAISE EXCEPTION 'Fees exceed proceeds'; END IF;
 UPDATE public.orders SET stars_settlement_id=batch,settled_amount=gross,settled_currency=_currency,settled_fee=fee,settled_affiliate=aff,settled_net=gross-fee-aff,settled_at=now() WHERE id=o.id;
 PERFORM public.credit_stars_order(o.id);
 END LOOP;
 RETURN batch;
END $$;
REVOKE EXECUTE ON FUNCTION public.settle_stars_orders(uuid,uuid[],numeric,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_stars_orders(uuid,uuid[],numeric,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.release_order_escrow(_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; seller uuid; aff numeric;
BEGIN
 UPDATE public.orders SET escrow_status='released',status='completed',completed_at=now(),updated_at=now() WHERE id=_order_id AND escrow_status='holding' RETURNING * INTO o;
 IF NOT FOUND THEN RETURN false; END IF;
 IF o.pay_method='stars' THEN PERFORM public.credit_stars_order(o.id);
 ELSE
 SELECT owner_id INTO seller FROM public.shops WHERE id=o.shop_id;
 aff:=CASE WHEN o.affiliate_user_id IS NOT NULL THEN round(o.total_amount*o.affiliate_percent/100,6) ELSE 0 END;
 INSERT INTO public.wallet_transactions(user_id,type,amount,currency,order_id,description) VALUES(seller,'sale',o.total_amount-o.commission_amount-aff,o.currency,o.id,'Order #'||o.order_number);
 IF aff>0 THEN INSERT INTO public.wallet_transactions(user_id,type,amount,currency,order_id,description) VALUES(o.affiliate_user_id,'commission',aff,o.currency,o.id,'Affiliate #'||o.order_number); END IF;
 END IF;
 UPDATE public.shops SET total_sales=total_sales+o.quantity WHERE id=o.shop_id;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.refund_order_escrow(_order_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF o.pay_method='stars' THEN RAISE EXCEPTION 'Stars refund must be processed through Telegram, not crypto wallet'; END IF;
 UPDATE public.orders SET escrow_status='refunded',status='refunded',updated_at=now() WHERE id=_order_id AND escrow_status IN ('holding','frozen') RETURNING * INTO o;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.wallet_transactions(user_id,type,amount,currency,order_id,description) VALUES(o.buyer_id,'refund',o.total_amount,o.currency,o.id,'Refund #'||o.order_number);
 UPDATE public.products SET stock=stock+o.quantity,sold_count=greatest(sold_count-o.quantity,0) WHERE id=o.product_id;
 RETURN true;
END $$;