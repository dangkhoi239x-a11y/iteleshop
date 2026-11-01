CREATE OR REPLACE FUNCTION public.run_draw(_actor uuid, _draw uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d lucky_draws; _ok boolean; _n integer;
BEGIN
  SELECT * INTO d FROM lucky_draws WHERE id = _draw FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draw not found'; END IF;
  _ok := has_role(_actor, 'admin') OR (d.shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM shops WHERE id = d.shop_id AND owner_id = _actor));
  IF NOT _ok THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF d.status <> 'open' THEN RAISE EXCEPTION 'Draw already finished'; END IF;
  IF now() < d.ends_at THEN RAISE EXCEPTION 'Draw has not ended yet'; END IF;
  INSERT INTO draw_winners(draw_id, user_id, display_name, rank)
  SELECT _draw, w.user_id, COALESCE(NULLIF(p.username, ''), NULLIF(p.first_name, ''), 'User'), w.rk
  FROM (SELECT user_id, row_number() OVER (ORDER BY max(random()) DESC) AS rk
        FROM draw_entries WHERE draw_id = _draw GROUP BY user_id) w
  LEFT JOIN profiles p ON p.id = w.user_id
  WHERE w.rk <= d.winners_count;
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE lucky_draws SET status = 'drawn', drawn_at = now() WHERE id = _draw;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.run_draw(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_draw(uuid, uuid) TO service_role;