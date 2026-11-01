CREATE TABLE public.reward_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  source text NOT NULL,
  ref_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reward_points_user_idx ON public.reward_points(user_id);
GRANT SELECT ON public.reward_points TO authenticated;
GRANT ALL ON public.reward_points TO service_role;
ALTER TABLE public.reward_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own points" ON public.reward_points FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.checkins (
  user_id uuid NOT NULL,
  day date NOT NULL,
  streak integer NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
GRANT SELECT ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins" ON public.checkins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.reward_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  kind text NOT NULL CHECK (kind IN ('join_channel','invite','first_purchase','spend','custom')),
  target text,
  target_amount numeric NOT NULL DEFAULT 0,
  link_url text,
  points integer NOT NULL CHECK (points > 0 AND points <= 100000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_tasks TO anon, authenticated;
GRANT ALL ON public.reward_tasks TO service_role;
ALTER TABLE public.reward_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public active tasks" ON public.reward_tasks FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "owner tasks" ON public.reward_tasks FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.task_completions (
  task_id uuid NOT NULL REFERENCES public.reward_tasks(id),
  user_id uuid NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
GRANT SELECT ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completions" ON public.task_completions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.lucky_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id),
  created_by uuid NOT NULL,
  title text NOT NULL,
  prize text NOT NULL,
  image_url text,
  entry_cost integer NOT NULL DEFAULT 0 CHECK (entry_cost >= 0),
  max_entries_per_user integer NOT NULL DEFAULT 1 CHECK (max_entries_per_user BETWEEN 1 AND 1000),
  winners_count integer NOT NULL DEFAULT 1 CHECK (winners_count BETWEEN 1 AND 1000),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','drawn','cancelled')),
  drawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT ON public.lucky_draws TO anon, authenticated;
GRANT ALL ON public.lucky_draws TO service_role;
ALTER TABLE public.lucky_draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public draws" ON public.lucky_draws FOR SELECT TO anon, authenticated USING (status <> 'cancelled' OR created_by = auth.uid());

CREATE TABLE public.draw_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lucky_draws(id),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX draw_entries_draw_idx ON public.draw_entries(draw_id, user_id);
GRANT SELECT ON public.draw_entries TO authenticated;
GRANT ALL ON public.draw_entries TO service_role;
ALTER TABLE public.draw_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entries" ON public.draw_entries FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.draw_winners (
  draw_id uuid NOT NULL REFERENCES public.lucky_draws(id),
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  rank integer NOT NULL,
  PRIMARY KEY (draw_id, user_id)
);
GRANT SELECT ON public.draw_winners TO anon, authenticated;
GRANT ALL ON public.draw_winners TO service_role;
ALTER TABLE public.draw_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public winners" ON public.draw_winners FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.daily_checkin(_user uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date; _prev integer; _streak integer; _pts integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('checkin:' || _user::text));
  IF EXISTS (SELECT 1 FROM checkins WHERE user_id = _user AND day = _today) THEN RAISE EXCEPTION 'Already checked in today'; END IF;
  SELECT streak INTO _prev FROM checkins WHERE user_id = _user AND day = _today - 1;
  _streak := COALESCE(_prev, 0) + 1;
  _pts := 10 + CASE WHEN _streak % 7 = 0 THEN 40 ELSE 0 END;
  INSERT INTO checkins(user_id, day, streak, points) VALUES (_user, _today, _streak, _pts);
  INSERT INTO reward_points(user_id, amount, source, note) VALUES (_user, _pts, 'checkin', 'Day ' || _streak);
  RETURN _pts;
END $$;

CREATE OR REPLACE FUNCTION public.award_task(_user uuid, _task uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t reward_tasks;
BEGIN
  SELECT * INTO t FROM reward_tasks WHERE id = _task AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not available'; END IF;
  INSERT INTO task_completions(task_id, user_id, points) VALUES (_task, _user, t.points);
  INSERT INTO reward_points(user_id, amount, source, ref_id, note) VALUES (_user, t.points, 'task', _task, t.title);
  RETURN t.points;
END $$;

CREATE OR REPLACE FUNCTION public.enter_draw(_user uuid, _draw uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d lucky_draws; _n integer; _bal integer;
BEGIN
  SELECT * INTO d FROM lucky_draws WHERE id = _draw FOR UPDATE;
  IF NOT FOUND OR d.status <> 'open' OR now() < d.starts_at OR now() >= d.ends_at THEN RAISE EXCEPTION 'Draw is not open'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('points:' || _user::text));
  SELECT count(*) INTO _n FROM draw_entries WHERE draw_id = _draw AND user_id = _user;
  IF _n >= d.max_entries_per_user THEN RAISE EXCEPTION 'Entry limit reached'; END IF;
  IF d.entry_cost > 0 THEN
    SELECT COALESCE(sum(amount), 0) INTO _bal FROM reward_points WHERE user_id = _user;
    IF _bal < d.entry_cost THEN RAISE EXCEPTION 'Not enough points'; END IF;
    INSERT INTO reward_points(user_id, amount, source, ref_id, note) VALUES (_user, -d.entry_cost, 'draw_entry', _draw, d.title);
  END IF;
  INSERT INTO draw_entries(draw_id, user_id) VALUES (_draw, _user);
  RETURN true;
END $$;

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
  SELECT _draw, w.user_id, COALESCE(NULLIF(p.username, ''), NULLIF(p.first_name, ''), 'User'), row_number() OVER ()
  FROM (SELECT user_id FROM (SELECT user_id, random() * count(*) OVER (PARTITION BY user_id) AS r FROM draw_entries WHERE draw_id = _draw) x
        GROUP BY user_id ORDER BY max(r) DESC LIMIT d.winners_count) w
  LEFT JOIN profiles p ON p.id = w.user_id;
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE lucky_draws SET status = 'drawn', drawn_at = now() WHERE id = _draw;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.daily_checkin(uuid), public.award_task(uuid, uuid), public.enter_draw(uuid, uuid), public.run_draw(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_checkin(uuid), public.award_task(uuid, uuid), public.enter_draw(uuid, uuid), public.run_draw(uuid, uuid) TO service_role;