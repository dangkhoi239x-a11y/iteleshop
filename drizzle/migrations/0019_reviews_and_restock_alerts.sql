-- Verified order reviews & auto-restock alerts
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product
  ON public.product_reviews (product_id, created_at DESC);

GRANT SELECT ON public.product_reviews TO anon, authenticated;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public product reviews"
  ON public.product_reviews FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.submit_order_review(
  _actor uuid,
  _order_id uuid,
  _rating integer,
  _comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _review_id uuid;
  _avg numeric(3,2);
BEGIN
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR _o.buyer_id <> _actor THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF _o.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed orders can be reviewed';
  END IF;

  INSERT INTO public.product_reviews (order_id, product_id, shop_id, buyer_id, rating, comment)
  VALUES (_o.id, _o.product_id, _o.shop_id, _actor, _rating, nullif(trim(coalesce(_comment, '')), ''))
  RETURNING id INTO _review_id;

  SELECT ROUND(AVG(rating)::numeric, 2) INTO _avg
  FROM public.product_reviews
  WHERE shop_id = _o.shop_id;

  UPDATE public.shops SET rating = COALESCE(_avg, 0) WHERE id = _o.shop_id;

  RETURN _review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_order_review(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_order_review(uuid, uuid, integer, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.restock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_restock_alerts_pending
  ON public.restock_alerts (product_id)
  WHERE notified_at IS NULL;

GRANT SELECT ON public.restock_alerts TO authenticated;
GRANT ALL ON public.restock_alerts TO service_role;
ALTER TABLE public.restock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own restock alerts"
  ON public.restock_alerts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
