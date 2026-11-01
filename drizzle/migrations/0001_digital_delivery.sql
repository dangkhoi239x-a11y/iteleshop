CREATE TABLE public.product_secrets (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_secrets TO authenticated;
GRANT ALL ON public.product_secrets TO service_role;
ALTER TABLE public.product_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner secrets" ON public.product_secrets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id WHERE p.id = product_id AND s.owner_id = auth.uid()));

ALTER TABLE public.orders ADD COLUMN delivered_content text;

CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _payment_id text, _pay_currency text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; secret text;
BEGIN
  UPDATE public.orders SET status = 'paid', escrow_status = 'holding', payment_status = 'finished',
         payment_id = _payment_id, pay_currency = _pay_currency, paid_at = now(), updated_at = now(),
         escrow_release_at = CASE WHEN warranty_type = 'none' THEN now() + make_interval(days => escrow_release_days) ELSE NULL END
   WHERE id = _order_id AND status IN ('awaiting_payment','expired') RETURNING * INTO o;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT content INTO secret FROM public.product_secrets WHERE product_id = o.product_id;
  IF secret IS NOT NULL THEN
    UPDATE public.orders SET delivered_content = secret, status = 'delivered' WHERE id = o.id;
  END IF;
  UPDATE public.products SET stock = greatest(stock - o.quantity, 0), sold_count = sold_count + o.quantity WHERE id = o.product_id;
  IF o.voucher_code IS NOT NULL THEN
    UPDATE public.vouchers SET used_count = used_count + 1 WHERE shop_id = o.shop_id AND code = o.voucher_code;
  END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, text) TO service_role;