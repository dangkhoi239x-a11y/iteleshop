CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id text NOT NULL UNIQUE,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  language text NOT NULL DEFAULT 'vi',
  referral_code text NOT NULL UNIQUE,
  referred_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  banner_url text,
  category text,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  rating numeric(3,2) NOT NULL DEFAULT 0,
  total_sales integer NOT NULL DEFAULT 0,
  wallet_address text,
  telegram_channel text,
  affiliate_percent numeric(5,2) NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shops TO anon, authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public active shops" ON public.shops FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "owner shop" ON public.shops FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "admin shops" ON public.shops FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.shop_bots (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  bot_token text,
  notification_chat_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_bots TO authenticated;
GRANT ALL ON public.shop_bots TO service_role;
ALTER TABLE public.shop_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner bot" ON public.shop_bots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(18,6) NOT NULL CHECK (price > 0),
  currency text NOT NULL DEFAULT 'USDT' CHECK (currency IN ('USDT','TON')),
  image_url text,
  category text,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status text NOT NULL DEFAULT 'active',
  flash_sale_price numeric(18,6),
  flash_sale_end timestamptz,
  warranty_type text NOT NULL DEFAULT 'standard' CHECK (warranty_type IN ('standard','none')),
  escrow_release_days integer NOT NULL DEFAULT 3,
  sold_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.products (shop_id);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public active products" ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'active' AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.status = 'active'));
CREATE POLICY "owner products" ON public.products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  buyer_id uuid NOT NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  product_image text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(18,6) NOT NULL,
  subtotal numeric(18,6) NOT NULL,
  discount_amount numeric(18,6) NOT NULL DEFAULT 0,
  total_amount numeric(18,6) NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_payment',
  invoice_id text,
  invoice_url text,
  payment_id text,
  payment_status text,
  pay_currency text,
  escrow_status text NOT NULL DEFAULT 'none',
  escrow_release_at timestamptz,
  warranty_type text NOT NULL DEFAULT 'standard',
  escrow_release_days integer NOT NULL DEFAULT 3,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  commission_amount numeric(18,6) NOT NULL DEFAULT 0,
  affiliate_user_id uuid,
  affiliate_percent numeric(5,2) NOT NULL DEFAULT 0,
  delivery_address text,
  note text,
  tracking_info text,
  voucher_code text,
  paid_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.orders (buyer_id);
CREATE INDEX ON public.orders (shop_id);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer orders" ON public.orders FOR SELECT TO authenticated USING (buyer_id = auth.uid());
CREATE POLICY "seller orders" ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));
CREATE POLICY "admin orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric(18,6) NOT NULL CHECK (discount_value > 0),
  min_order_amount numeric(18,6),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, code)
);
GRANT SELECT ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner vouchers" ON public.vouchers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));

CREATE TABLE public.commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_order_amount numeric(18,6) NOT NULL DEFAULT 0,
  max_order_amount numeric(18,6),
  commission_percent numeric(5,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_tiers TO anon, authenticated;
GRANT ALL ON public.commission_tiers TO service_role;
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public tiers" ON public.commission_tiers FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.commission_tiers (min_order_amount, max_order_amount, commission_percent) VALUES
  (0, 100, 5), (100, 1000, 3), (1000, NULL, 2);

CREATE TABLE public.affiliates (
  user_id uuid PRIMARY KEY,
  tier text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'active',
  channel_url text,
  audience_size integer,
  niche text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own affiliate" ON public.affiliates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin affiliates" ON public.affiliates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  opened_by uuid NOT NULL,
  reason text NOT NULL,
  buyer_note text,
  seller_note text,
  admin_note text,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties disputes" ON public.disputes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o JOIN public.shops s ON s.id = o.shop_id
          WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR s.owner_id = auth.uid()))
  OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('sale','commission','refund','withdrawal','adjustment')),
  amount numeric(18,6) NOT NULL,
  currency text NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','rejected')),
  to_address text,
  tx_hash text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.wallet_transactions (user_id);
CREATE UNIQUE INDEX wallet_tx_order_unique ON public.wallet_transactions (order_id, user_id, type) WHERE order_id IS NOT NULL;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tx" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin tx" ON public.wallet_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.release_order_escrow(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; seller uuid; aff numeric;
BEGIN
  UPDATE public.orders SET escrow_status = 'released', status = 'completed', completed_at = now(), updated_at = now()
   WHERE id = _order_id AND escrow_status = 'holding' RETURNING * INTO o;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT owner_id INTO seller FROM public.shops WHERE id = o.shop_id;
  aff := CASE WHEN o.affiliate_user_id IS NOT NULL THEN round(o.total_amount * o.affiliate_percent / 100, 6) ELSE 0 END;
  INSERT INTO public.wallet_transactions (user_id, type, amount, currency, order_id, description)
    VALUES (seller, 'sale', o.total_amount - o.commission_amount - aff, o.currency, o.id, 'Order #' || o.order_number);
  IF aff > 0 THEN
    INSERT INTO public.wallet_transactions (user_id, type, amount, currency, order_id, description)
      VALUES (o.affiliate_user_id, 'commission', aff, o.currency, o.id, 'Affiliate commission #' || o.order_number);
  END IF;
  UPDATE public.shops SET total_sales = total_sales + o.quantity WHERE id = o.shop_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.refund_order_escrow(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  UPDATE public.orders SET escrow_status = 'refunded', status = 'refunded', updated_at = now()
   WHERE id = _order_id AND escrow_status IN ('holding','frozen') RETURNING * INTO o;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.wallet_transactions (user_id, type, amount, currency, order_id, description)
    VALUES (o.buyer_id, 'refund', o.total_amount, o.currency, o.id, 'Refund #' || o.order_number);
  UPDATE public.products SET stock = stock + o.quantity, sold_count = greatest(sold_count - o.quantity, 0) WHERE id = o.product_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _payment_id text, _pay_currency text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  UPDATE public.orders SET status = 'paid', escrow_status = 'holding', payment_status = 'finished',
         payment_id = _payment_id, pay_currency = _pay_currency, paid_at = now(), updated_at = now(),
         escrow_release_at = CASE WHEN warranty_type = 'none' THEN now() + make_interval(days => escrow_release_days) ELSE NULL END
   WHERE id = _order_id AND status IN ('awaiting_payment','expired') RETURNING * INTO o;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.products SET stock = greatest(stock - o.quantity, 0), sold_count = sold_count + o.quantity WHERE id = o.product_id;
  IF o.voucher_code IS NOT NULL THEN
    UPDATE public.vouchers SET used_count = used_count + 1 WHERE shop_id = o.shop_id AND code = o.voucher_code;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_user_id uuid, _amount numeric, _currency text, _address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal numeric; new_id uuid;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_user_id::text || _currency));
  SELECT coalesce(sum(amount), 0) INTO bal FROM public.wallet_transactions
   WHERE user_id = _user_id AND currency = _currency AND status <> 'rejected';
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO public.wallet_transactions (user_id, type, amount, currency, status, to_address, description)
    VALUES (_user_id, 'withdrawal', -_amount, _currency, 'pending', _address, 'Withdrawal') RETURNING id INTO new_id;
  RETURN new_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.release_order_escrow(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_order_escrow(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_escrow(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_order_escrow(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text) TO service_role;
