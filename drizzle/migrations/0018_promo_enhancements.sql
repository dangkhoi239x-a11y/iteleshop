-- Promo 2 (points-to-voucher), Promo 3 (first_time / win_back), Promo 4 (private channel promo)
ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'first_time', 'win_back', 'channel', 'points')),
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vouchers_target_user
  ON public.vouchers (target_user_id)
  WHERE target_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.redeem_points_for_voucher(
  _user uuid,
  _shop_id uuid,
  _points_cost integer,
  _discount_percent numeric,
  _min_order_amount numeric DEFAULT NULL,
  _days_valid integer DEFAULT 30
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bal bigint;
  _shop_status text;
  _code text;
BEGIN
  IF _points_cost IS NULL OR _points_cost <= 0 THEN
    RAISE EXCEPTION 'Invalid points cost';
  END IF;
  IF _discount_percent IS NULL OR _discount_percent <= 0 OR _discount_percent > 90 THEN
    RAISE EXCEPTION 'Invalid discount percent';
  END IF;
  IF _days_valid IS NULL OR _days_valid < 1 OR _days_valid > 365 THEN
    RAISE EXCEPTION 'Invalid validity days';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_user::text));

  SELECT status INTO _shop_status FROM public.shops WHERE id = _shop_id;
  IF _shop_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Shop is not active';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _bal FROM public.reward_points WHERE user_id = _user;
  IF _bal < _points_cost THEN
    RAISE EXCEPTION 'Not enough reward points';
  END IF;

  _code := 'PTS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.reward_points (user_id, amount, source, note)
  VALUES (_user, -_points_cost, 'voucher_redeem', 'Redeem voucher ' || _code);

  INSERT INTO public.vouchers (
    shop_id, code, discount_type, discount_value, min_order_amount,
    max_uses, expires_at, is_active, audience, target_user_id
  )
  VALUES (
    _shop_id, _code, 'percent', _discount_percent, _min_order_amount,
    1, now() + (_days_valid || ' days')::interval, true, 'points', _user
  );

  RETURN _code;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_points_for_voucher(uuid, uuid, integer, numeric, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_points_for_voucher(uuid, uuid, integer, numeric, numeric, integer) TO service_role;
