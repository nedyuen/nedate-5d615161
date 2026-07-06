-- Undated friend requests: allow start_time null + add schedule_status
-- schedule_status only represents whether the date/time is confirmed.
-- It does NOT represent approval, attendance, or existence.
-- An approved hangout may legitimately have schedule_status='unscheduled'.

-- 1. Add column with safe default
ALTER TABLE public.requests
  ADD COLUMN schedule_status text NOT NULL DEFAULT 'scheduled';

COMMENT ON COLUMN public.requests.schedule_status IS
  'Whether the date/time is confirmed. scheduled=start_time set; unscheduled=awaiting Ned''s suggestion. Independent of request_status/hangout_status. Only friend_request rows may be unscheduled.';

-- 2. Relax start_time
ALTER TABLE public.requests
  ALTER COLUMN start_time DROP NOT NULL;

-- 3. Pre-constraint validation: abort if any historical row would violate new rules
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.requests WHERE schedule_status NOT IN ('scheduled','unscheduled')) THEN
    RAISE EXCEPTION 'Migration aborted: rows have invalid schedule_status values';
  END IF;
  IF EXISTS (SELECT 1 FROM public.requests WHERE schedule_status='unscheduled' AND hangout_kind <> 'friend_request') THEN
    RAISE EXCEPTION 'Migration aborted: non-friend_request rows cannot be unscheduled';
  END IF;
  IF EXISTS (SELECT 1 FROM public.requests WHERE schedule_status='scheduled' AND start_time IS NULL) THEN
    RAISE EXCEPTION 'Migration aborted: scheduled rows must have start_time';
  END IF;
END $$;

-- 4. Domain constraint
ALTER TABLE public.requests
  ADD CONSTRAINT requests_schedule_status_chk
  CHECK (schedule_status IN ('scheduled','unscheduled'));

-- 5. Kind restriction: only friend_request may be unscheduled
ALTER TABLE public.requests
  ADD CONSTRAINT requests_unscheduled_kind_chk
  CHECK (schedule_status = 'scheduled' OR hangout_kind = 'friend_request');

-- 6. Sanity trigger: scheduled => start_time not null
CREATE OR REPLACE FUNCTION public.tg_requests_schedule_sanity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.schedule_status = 'scheduled' AND NEW.start_time IS NULL THEN
    RAISE EXCEPTION 'schedule_status=scheduled requires start_time';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_requests_schedule_sanity ON public.requests;
CREATE TRIGGER trg_requests_schedule_sanity
  BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_requests_schedule_sanity();