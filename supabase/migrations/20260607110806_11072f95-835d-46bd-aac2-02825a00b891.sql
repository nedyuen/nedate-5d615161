
-- 1. Add new columns to requests
ALTER TABLE public.requests
  ADD COLUMN hangout_kind text,
  ADD COLUMN initiator text,
  ADD COLUMN visibility text,
  ADD COLUMN hangout_status text,
  ADD COLUMN request_status text,
  ADD COLUMN title text,
  ADD COLUMN parent_hangout_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  ADD COLUMN request_message text,
  ADD COLUMN custom_venue_name text,
  ADD COLUMN custom_venue_location text,
  ADD COLUMN custom_venue_image_url text;

-- 2. Backfill from existing data
UPDATE public.requests SET
  hangout_kind = 'friend_request',
  initiator = 'friend',
  visibility = 'private',
  hangout_status = 'active',
  request_status = COALESCE(status, 'pending'),
  custom_venue_name = custom_venue;

-- 3. Ensure curated-or-custom venue (existing rows may have neither — fall back to a placeholder custom name so constraint passes)
UPDATE public.requests
  SET custom_venue_name = 'Unspecified'
  WHERE venue_id IS NULL AND custom_venue_name IS NULL;

-- 4. NOT NULL constraints on new required cols
ALTER TABLE public.requests
  ALTER COLUMN hangout_kind SET NOT NULL,
  ALTER COLUMN initiator SET NOT NULL,
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN hangout_status SET NOT NULL,
  ALTER COLUMN hangout_kind SET DEFAULT 'friend_request',
  ALTER COLUMN initiator SET DEFAULT 'friend',
  ALTER COLUMN visibility SET DEFAULT 'private',
  ALTER COLUMN hangout_status SET DEFAULT 'active';

-- 5. Make requester fields nullable (Ned-initiated hangouts have no requester)
ALTER TABLE public.requests
  ALTER COLUMN requester_name DROP NOT NULL,
  ALTER COLUMN requester_email DROP NOT NULL,
  ALTER COLUMN pitch DROP NOT NULL;

-- 6. Drop the old columns
ALTER TABLE public.requests
  DROP COLUMN status,
  DROP COLUMN custom_venue;

-- 7. Add CHECK constraints (after data is consistent)
ALTER TABLE public.requests
  ADD CONSTRAINT chk_hangout_kind CHECK (hangout_kind IN ('friend_request','public_hangout','private_hangout','join_request')),
  ADD CONSTRAINT chk_initiator CHECK (initiator IN ('friend','ned')),
  ADD CONSTRAINT chk_visibility CHECK (visibility IN ('public','private')),
  ADD CONSTRAINT chk_hangout_status CHECK (hangout_status IN ('draft','active','cancelled','completed')),
  ADD CONSTRAINT chk_request_status CHECK (request_status IS NULL OR request_status IN ('pending','approved','rejected')),
  ADD CONSTRAINT chk_request_status_presence CHECK (
    (hangout_kind IN ('friend_request','join_request') AND request_status IS NOT NULL)
    OR (hangout_kind IN ('public_hangout','private_hangout') AND request_status IS NULL)
  ),
  ADD CONSTRAINT chk_parent_hangout CHECK (
    (hangout_kind = 'join_request' AND parent_hangout_id IS NOT NULL)
    OR (hangout_kind <> 'join_request' AND parent_hangout_id IS NULL)
  ),
  ADD CONSTRAINT chk_requester_fields CHECK (
    (hangout_kind IN ('friend_request','join_request') AND requester_name IS NOT NULL AND requester_email IS NOT NULL)
    OR (hangout_kind IN ('public_hangout','private_hangout') AND requester_name IS NULL AND requester_email IS NULL)
  ),
  ADD CONSTRAINT chk_venue_exclusive CHECK (
    (venue_id IS NOT NULL)::int + (custom_venue_name IS NOT NULL)::int = 1
  ),
  ADD CONSTRAINT chk_initiator_kind CHECK (
    (initiator = 'ned' AND hangout_kind IN ('public_hangout','private_hangout'))
    OR (initiator = 'friend' AND hangout_kind IN ('friend_request','join_request'))
  ),
  ADD CONSTRAINT chk_visibility_consistency CHECK (
    (hangout_kind = 'public_hangout' AND visibility = 'public')
    OR (hangout_kind <> 'public_hangout' AND visibility = 'private')
  );

-- 8. Helpful indexes
CREATE INDEX idx_requests_hangout_kind ON public.requests(hangout_kind);
CREATE INDEX idx_requests_visibility ON public.requests(visibility);
CREATE INDEX idx_requests_parent ON public.requests(parent_hangout_id);
CREATE INDEX idx_requests_start_time ON public.requests(start_time);

-- 9. Create hangout_invitees table
CREATE TABLE public.hangout_invitees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hangout_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  slug text NOT NULL UNIQUE DEFAULT substr(md5(((random())::text || (clock_timestamp())::text)), 1, 16),
  response_status text NOT NULL DEFAULT 'pending' CHECK (response_status IN ('pending','accepted','declined','maybe')),
  comment text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hangout_invitees_hangout ON public.hangout_invitees(hangout_id);

-- 10. Grants — service role only. Browser never touches this table.
GRANT ALL ON public.hangout_invitees TO service_role;

-- 11. RLS on with no public policies; only service role can access.
ALTER TABLE public.hangout_invitees ENABLE ROW LEVEL SECURITY;
