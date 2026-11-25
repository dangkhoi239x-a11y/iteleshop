-- Upgrade product_codes: unique per product, expiry (FEFO), and low-stock threshold
ALTER TABLE public.product_codes
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_codes_unique_content
  ON public.product_codes (product_id, content);

CREATE INDEX IF NOT EXISTS idx_product_codes_fefo
  ON public.product_codes (product_id, expires_at NULLS LAST, created_at, id)
  WHERE status = 'available';

CREATE OR REPLACE FUNCTION public.fulfill_paid_order(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  p public.products;
  ids uuid[];
  claimed text;
  has_codes boolean;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.paid_at IS NULL OR o.escrow_status NOT IN ('holding', 'frozen') THEN
    RETURN false;
  END IF;
  IF o.fulfillment_state = 'ready' THEN
    RETURN true;
  END IF;

  SELECT * INTO p FROM public.products WHERE id = o.product_id FOR UPDATE;

  IF p.fulfillment_mode = 'webhook_api' THEN
    UPDATE public.orders
    SET fulfillment_state = 'pending_external',
        fulfillment_error = NULL,
        updated_at = now()
    WHERE id = o.id;
    RETURN false;
  END IF;

  SELECT p.goods_kind = 'digital' OR EXISTS (SELECT 1 FROM public.product_codes WHERE product_id = p.id) INTO has_codes;
  IF has_codes THEN
    -- FEFO: deliver non-expired codes, earliest expiry first
    SELECT array_agg(id) INTO ids
    FROM (
      SELECT id FROM public.product_codes
      WHERE product_id = p.id
        AND status = 'available'
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY expires_at ASC NULLS LAST, created_at ASC, id ASC
      LIMIT o.quantity
      FOR UPDATE
    ) picked;

    IF coalesce(cardinality(ids), 0) <> o.quantity THEN
      UPDATE public.orders
      SET fulfillment_state = 'shortage',
          fulfillment_error = 'Not enough available codes',
          escrow_release_at = NULL,
          updated_at = now()
      WHERE id = o.id;
      UPDATE public.products
      SET stock = (
        SELECT count(*) FROM public.product_codes
        WHERE product_id = p.id AND status = 'available' AND (expires_at IS NULL OR expires_at > now())
      )
      WHERE id = p.id;
      RETURN false;
    END IF;

    UPDATE public.product_codes SET status = 'sold', order_id = o.id, sold_at = now() WHERE id = ANY(ids);
    SELECT string_agg(content, E'\n' ORDER BY expires_at ASC NULLS LAST, created_at ASC, id ASC) INTO claimed
    FROM public.product_codes WHERE id = ANY(ids);

    UPDATE public.products
    SET stock = (
          SELECT count(*) FROM public.product_codes
          WHERE product_id = p.id AND status = 'available' AND (expires_at IS NULL OR expires_at > now())
        ),
        sold_count = sold_count + o.quantity
    WHERE id = p.id;
  ELSE
    IF p.stock < o.quantity THEN
      UPDATE public.orders
      SET fulfillment_state = 'shortage',
          fulfillment_error = 'Not enough stock',
          escrow_release_at = NULL,
          updated_at = now()
      WHERE id = o.id;
      RETURN false;
    END IF;
    UPDATE public.products SET stock = stock - o.quantity, sold_count = sold_count + o.quantity WHERE id = p.id;
  END IF;

  UPDATE public.orders
  SET fulfillment_state = 'ready',
      fulfillment_error = NULL,
      delivered_content = claimed,
      buyer_guide = p.buyer_guide,
      status = CASE WHEN has_codes THEN 'delivered' ELSE 'paid' END,
      escrow_release_at = CASE WHEN warranty_type = 'none' THEN now() + make_interval(days => escrow_release_days) ELSE NULL END,
      updated_at = now()
  WHERE id = o.id;
  RETURN true;
END;
$$;
