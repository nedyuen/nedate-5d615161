
-- Drop overly-permissive ALL policies
DROP POLICY IF EXISTS "open requests" ON public.requests;
DROP POLICY IF EXISTS "open venues" ON public.venues;

-- Venues: public catalog. Public read only. Writes only via service_role (server functions).
CREATE POLICY "venues_public_read" ON public.venues
  FOR SELECT TO anon, authenticated
  USING (true);

-- Requests: no anon/authenticated access of any kind. All access via service_role.
-- (RLS enabled + no policies = locked. Server functions use supabaseAdmin which bypasses RLS.)

-- Tighten Data API grants to match policies
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.requests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.venues FROM anon, authenticated;
GRANT SELECT ON public.venues TO anon, authenticated;

-- Ensure service_role retains full access on all tables
GRANT ALL ON public.requests TO service_role;
GRANT ALL ON public.venues TO service_role;
GRANT ALL ON public.hangout_invitees TO service_role;
