-- Dynamic external webhook/API fulfillment for digital products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'pool'
    CHECK (fulfillment_mode IN ('pool', 'webhook_api')),
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS external_sku text;

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
    SELECT array_agg(id) INTO ids
    FROM (
      SELECT id FROM public.product_codes
      WHERE product_id = p.id AND status = 'available'
      ORDER BY created_at, id
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
      SET stock = (SELECT count(*) FROM public.product_codes WHERE product_id = p.id AND status = 'available')
      WHERE id = p.id;
      RETURN false;
    END IF;
    UPDATE public.product_codes SET status = 'sold', order_id = o.id, sold_at = now() WHERE id = ANY(ids);
    SELECT string_agg(content, E'\n' ORDER BY created_at, id) INTO claimed FROM public.product_codes WHERE id = ANY(ids);
    UPDATE public.products
    SET stock = (SELECT count(*) FROM public.product_codes WHERE product_id = p.id AND status = 'available'),
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

CREATE OR REPLACE FUNCTION public.complete_external_fulfillment(
  _order_id uuid,
  _codes text[],
  _buyer_guide text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  p public.products;
  _c text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.paid_at IS NULL OR o.escrow_status NOT IN ('holding', 'frozen') THEN
    RETURN false;
  END IF;
  IF o.fulfillment_state = 'ready' THEN
    RETURN true;
  END IF;
  IF coalesce(cardinality(_codes), 0) <> o.quantity THEN
    RAISE EXCEPTION 'Expected % codes, got %', o.quantity, coalesce(cardinality(_codes), 0);
  END IF;

  SELECT * INTO p FROM public.products WHERE id = o.product_id FOR UPDATE;

  FOREACH _c IN ARRAY _codes LOOP
    IF trim(coalesce(_c, '')) = '' THEN
      RAISE EXCEPTION 'Empty code in external fulfillment';
    END IF;
    INSERT INTO public.product_codes (product_id, content, status, order_id, sold_at)
    VALUES (p.id, trim(_c), 'sold', o.id, now());
  END LOOP;

  UPDATE public.products
  SET stock = GREATEST(0, stock - o.quantity),
      sold_count = sold_count + o.quantity
  WHERE id = p.id;

  UPDATE public.orders
  SET fulfillment_state = 'ready',
      fulfillment_error = NULL,
      delivered_content = array_to_string(_codes, E'\n'),
      buyer_guide = coalesce(nullif(trim(coalesce(_buyer_guide, '')), ''), p.buyer_guide),
      status = 'delivered',
      escrow_release_at = CASE WHEN o.warranty_type = 'none' THEN now() + make_interval(days => o.escrow_release_days) ELSE NULL END,
      updated_at = now()
  WHERE id = o.id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_external_fulfillment(_order_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET fulfillment_state = 'shortage',
      fulfillment_error = left(coalesce(_reason, 'External API error'), 300),
      escrow_release_at = NULL,
      updated_at = now()
  WHERE id = _order_id
    AND paid_at IS NOT NULL
    AND fulfillment_state <> 'ready';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_external_fulfillment(uuid, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_external_fulfillment(uuid, text[], text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fail_external_fulfillment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_external_fulfillment(uuid, text) TO service_role;
