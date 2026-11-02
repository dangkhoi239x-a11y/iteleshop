CREATE TABLE public.telegram_channels (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, chat_id text NOT NULL UNIQUE, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.telegram_channels TO authenticated;
GRANT ALL ON public.telegram_channels TO service_role;
ALTER TABLE public.telegram_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read channels" ON public.telegram_channels FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.telegram_delivery_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_user_id uuid, chat_id text NOT NULL, event text NOT NULL, status text NOT NULL CHECK(status IN ('sent','failed','skipped')), message_id bigint, error_code text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.telegram_delivery_logs TO authenticated;
GRANT ALL ON public.telegram_delivery_logs TO service_role;
ALTER TABLE public.telegram_delivery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipient and admin history" ON public.telegram_delivery_logs FOR SELECT TO authenticated USING(recipient_user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.telegram_delivery_logs(created_at DESC);
CREATE TABLE public.withdrawal_policies (currency text PRIMARY KEY CHECK(currency IN ('USDT','TON')), enabled boolean NOT NULL DEFAULT false, fee_mode text NOT NULL DEFAULT 'network' CHECK(fee_mode IN ('network','percentage','fixed')), fee_value numeric(18,6) NOT NULL DEFAULT 0 CHECK(fee_value>=0), minimum numeric(18,6) NOT NULL DEFAULT 1 CHECK(minimum>0), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.withdrawal_policies TO authenticated;
GRANT ALL ON public.withdrawal_policies TO service_role;
ALTER TABLE public.withdrawal_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated fee reads" ON public.withdrawal_policies FOR SELECT TO authenticated USING(true);
CREATE OR REPLACE FUNCTION public.finish_withdrawal(_actor uuid,_id uuid,_approve boolean,_tx_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.wallet_transactions;
BEGIN
IF NOT public.has_role(_actor,'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
SELECT * INTO w FROM public.wallet_transactions WHERE id=_id FOR UPDATE;
IF NOT FOUND OR w.type<>'withdrawal' OR w.status<>'pending' THEN RAISE EXCEPTION 'Withdrawal is not pending'; END IF;
IF _approve AND length(trim(coalesce(_tx_hash,'')))<10 THEN RAISE EXCEPTION 'Verified transaction reference required'; END IF;
UPDATE public.wallet_transactions SET status=CASE WHEN _approve THEN 'completed' ELSE 'rejected' END,tx_hash=CASE WHEN _approve THEN trim(_tx_hash) ELSE NULL END WHERE id=_id;
RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.finish_withdrawal(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_withdrawal(uuid,uuid,boolean,text) TO service_role;