ALTER TABLE public.products ADD COLUMN buy_x integer, ADD COLUMN get_y integer;
ALTER TABLE public.orders ADD COLUMN pay_method text NOT NULL DEFAULT 'crypto', ADD COLUMN free_quantity integer NOT NULL DEFAULT 0, ADD COLUMN stars_amount integer;
ALTER TABLE public.vouchers ADD COLUMN last_broadcast_at timestamptz;
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  stars_enabled boolean NOT NULL DEFAULT false,
  stars_per_usdt numeric NOT NULL DEFAULT 77 CHECK (stars_per_usdt > 0),
  stars_per_ton numeric NOT NULL DEFAULT 250 CHECK (stars_per_ton > 0),
  crypto_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads platform settings" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;