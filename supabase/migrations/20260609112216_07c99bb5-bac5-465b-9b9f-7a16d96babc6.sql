
-- =============================================================
-- hangout_participants
-- =============================================================
CREATE TABLE public.hangout_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('ned','requester','invitee','attendee')),
  slug text,
  email text,
  display_name text,
  role_source text NOT NULL CHECK (role_source IN ('friend_request','invite','join_request','ned')),
  source_row_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  needs_reconfirmation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.hangout_participants TO service_role;
ALTER TABLE public.hangout_participants ENABLE ROW LEVEL SECURITY;
-- No public policies; all access through server fns using service role.

CREATE UNIQUE INDEX hangout_participants_one_ned_per_hangout
  ON public.hangout_participants (hangout_id) WHERE type = 'ned';

CREATE UNIQUE INDEX hangout_participants_slug_unique
  ON public.hangout_participants (slug) WHERE slug IS NOT NULL;

CREATE INDEX hangout_participants_hangout_idx
  ON public.hangout_participants (hangout_id, is_active);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER hangout_participants_updated
BEFORE UPDATE ON public.hangout_participants
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============================================================
-- hangout_change_requests
-- =============================================================
CREATE TABLE public.hangout_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  proposed_by_participant_id uuid NOT NULL REFERENCES public.hangout_participants(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  old_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposer_comment text,
  responder_participant_id uuid REFERENCES public.hangout_participants(id),
  responder_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

GRANT ALL ON public.hangout_change_requests TO service_role;
ALTER TABLE public.hangout_change_requests ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX hangout_change_requests_one_pending
  ON public.hangout_change_requests (hangout_id) WHERE status = 'pending';

CREATE INDEX hangout_change_requests_hangout_idx
  ON public.hangout_change_requests (hangout_id, created_at DESC);

-- =============================================================
-- Backfill participants from existing data
-- =============================================================

-- Ned participant for every Ned-initiated hangout
INSERT INTO public.hangout_participants (hangout_id, type, role_source, display_name, email)
SELECT id, 'ned', 'ned', 'Ned', NULL
FROM public.requests
WHERE initiator = 'ned'
ON CONFLICT DO NOTHING;

-- Friend request: hangout owned by Ned + requester participant.
-- friend_request rows ARE hangouts (initiator='friend'). They need a Ned participant too.
INSERT INTO public.hangout_participants (hangout_id, type, role_source, display_name)
SELECT id, 'ned', 'ned', 'Ned'
FROM public.requests
WHERE hangout_kind = 'friend_request'
ON CONFLICT DO NOTHING;

INSERT INTO public.hangout_participants
  (hangout_id, type, slug, email, display_name, role_source, source_row_id)
SELECT id, 'requester', slug, requester_email, requester_name, 'friend_request', id
FROM public.requests
WHERE hangout_kind = 'friend_request' AND slug IS NOT NULL;

-- Approved join_requests → attendee participants on the PARENT hangout
INSERT INTO public.hangout_participants
  (hangout_id, type, slug, email, display_name, role_source, source_row_id)
SELECT parent_hangout_id, 'attendee', slug, requester_email, requester_name, 'join_request', id
FROM public.requests
WHERE hangout_kind = 'join_request'
  AND request_status = 'approved'
  AND parent_hangout_id IS NOT NULL
  AND slug IS NOT NULL;

-- Invitees → invitee participants
INSERT INTO public.hangout_participants
  (hangout_id, type, slug, email, display_name, role_source, source_row_id)
SELECT hangout_id, 'invitee', slug, email, name, 'invite', id
FROM public.hangout_invitees
WHERE slug IS NOT NULL;
