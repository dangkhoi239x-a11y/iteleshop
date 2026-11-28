-- PayOS (VietQR VND) & Binance Pay support
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payos_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS binance_pay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vnd_per_usdt numeric NOT NULL DEFAULT 25500 CHECK (vnd_per_usdt > 0),
  ADD COLUMN IF NOT EXISTS vnd_per_ton numeric NOT NULL DEFAULT 130000 CHECK (vnd_per_ton > 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fiat_amount_vnd bigint;
