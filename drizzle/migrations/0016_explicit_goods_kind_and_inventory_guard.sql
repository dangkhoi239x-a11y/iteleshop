ALTER TABLE public.products ADD COLUMN goods_kind text NOT NULL DEFAULT 'digital' CHECK(goods_kind IN ('digital','physical'));
CREATE OR REPLACE FUNCTION public.guard_product_code_inventory() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD.status<>'available' THEN RAISE EXCEPTION 'Disclosed codes cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='sold' AND NEW.status='available' THEN RAISE EXCEPTION 'Disclosed codes cannot be resold'; END IF;
 IF TG_OP='DELETE' THEN PERFORM id FROM public.products WHERE id=OLD.product_id FOR UPDATE; RETURN OLD; END IF;
 PERFORM id FROM public.products WHERE id=NEW.product_id FOR UPDATE;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_product_code_inventory BEFORE INSERT OR UPDATE OR DELETE ON public.product_codes FOR EACH ROW EXECUTE FUNCTION public.guard_product_code_inventory();
CREATE OR REPLACE FUNCTION public.sync_code_stock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
 pid:=CASE WHEN TG_OP='DELETE' THEN OLD.product_id ELSE NEW.product_id END;
 UPDATE public.products SET stock=(SELECT count(*) FROM public.product_codes WHERE product_id=pid AND status='available') WHERE id=pid;
 RETURN NULL;
END $$;
CREATE TRIGGER sync_code_stock AFTER INSERT OR UPDATE OR DELETE ON public.product_codes FOR EACH ROW EXECUTE FUNCTION public.sync_code_stock();
CREATE OR REPLACE FUNCTION public.guard_stars_refund_settlement() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.stars_settlement_id IS DISTINCT FROM OLD.stars_settlement_id AND OLD.stars_refund_state IS NOT NULL THEN RAISE EXCEPTION 'Stars refund is in progress'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_stars_refund_settlement BEFORE UPDATE OF stars_settlement_id ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_stars_refund_settlement();