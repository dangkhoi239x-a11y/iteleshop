ALTER TABLE public.products ADD COLUMN auto_send_telegram boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN buyer_guide text;
ALTER TABLE public.products ADD COLUMN highlights text;
ALTER TABLE public.orders ADD COLUMN buyer_guide text;