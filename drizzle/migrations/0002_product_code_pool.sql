-- Kho mã số: mỗi mã/link là một hàng, bán đúng một lần.
CREATE TABLE public.product_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold','disabled')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  sold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_codes_available_idx ON public.product_codes (product_id) WHERE status = 'available';
CREATE INDEX product_codes_order_idx ON public.product_codes (order_id) WHERE order_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_codes TO authenticated;
GRANT ALL ON public.product_codes TO service_role;
ALTER TABLE public.product_codes ENABLE ROW LEVEL SECURITY;

-- Seller manages and views codes of own products; buyer sees only codes sold to their own orders.
CREATE POLICY "seller manages codes" ON public.product_codes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id WHERE p.id = product_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id WHERE p.id = product_id AND s.owner_id = auth.uid()));
CREATE POLICY "buyer reads own codes" ON public.product_codes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));

-- Chuyển nội dung giao hàng cũ (một chuỗi dùng chung) thành các mã riêng khi có nhiều dòng.
INSERT INTO public.product_codes (product_id, content)
SELECT ps.product_id, trim(line)
FROM public.product_secrets ps
CROSS JOIN LATERAL unnest(string_to_array(ps.content, E'\n')) AS line
WHERE trim(line) <> '';

-- Đồng bộ tồn kho với số mã còn lại cho sản phẩm có kho mã.
UPDATE public.products p
SET stock = (SELECT count(*) FROM public.product_codes c WHERE c.product_id = p.id AND c.status = 'available')
WHERE EXISTS (SELECT 1 FROM public.product_codes c WHERE c.product_id = p.id);

COMMENT ON TABLE public.product_secrets IS 'DEPRECATED: replaced by product_codes (one code per unit). Kept for reference only.';

-- mark_order_paid: nhận đúng N mã còn trống một cách nguyên tử, gán vào đơn; thiếu mã thì báo lỗi.
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _payment_id text, _pay_currency text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; claimed text; n int;
BEGIN
  UPDATE public.orders SET status = 'paid', escrow_status = 'holding', payment_status = 'finished',
         payment_id = _payment_id, pay_currency = _pay_currency, paid_at = now(), updated_at = now(),
         escrow_release_at = CASE WHEN warranty_type = 'none' THEN now() + make_interval(days => escrow_release_days) ELSE NULL END
   WHERE id = _order_id AND status IN ('awaiting_payment','expired') RETURNING * INTO o;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT count(*) INTO n FROM public.product_codes WHERE product_id = o.product_id;
  IF n > 0 THEN
    WITH picked AS (
      SELECT id FROM public.product_codes
      WHERE product_id = o.product_id AND status = 'available'
      ORDER BY created_at LIMIT o.quantity FOR UPDATE SKIP LOCKED
    ), upd AS (
      UPDATE public.product_codes c SET status = 'sold', order_id = o.id, sold_at = now()
      FROM picked WHERE c.id = picked.id RETURNING c.content
    )
    SELECT string_agg(content, E'\n') INTO claimed FROM upd;
    IF claimed IS NOT NULL THEN
      UPDATE public.orders SET delivered_content = claimed, status = 'delivered' WHERE id = o.id;
    END IF;
    UPDATE public.products SET stock = (SELECT count(*) FROM public.product_codes WHERE product_id = o.product_id AND status = 'available') WHERE id = o.product_id;
  ELSE
    UPDATE public.products SET stock = greatest(stock - o.quantity, 0) WHERE id = o.product_id;
  END IF;

  UPDATE public.products SET sold_count = sold_count + o.quantity WHERE id = o.product_id;
  IF o.voucher_code IS NOT NULL THEN
    UPDATE public.vouchers SET used_count = used_count + 1 WHERE shop_id = o.shop_id AND code = o.voucher_code;
  END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, text) TO service_role;