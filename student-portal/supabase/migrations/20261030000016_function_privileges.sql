-- =============================================================================
-- 0016 · Function privileges: nothing is executable through PUBLIC.
--
-- Found by the Supabase security advisor on the real project after 0001–0014 were applied:
-- 0010 revoked EXECUTE from anon, but Postgres grants EXECUTE on every new function to
-- PUBLIC, and anon inherits PUBLIC. So 66 SECURITY DEFINER functions were still callable
-- through /rest/v1/rpc by signed-out visitors. Each of them refuses a null auth.uid()
-- (helpers return false, RPCs raise 42501), so no data was exposed, but the surface must
-- be closed rather than relying on every function body.
--
-- After this migration:
--   * anon can execute no function in public (no anon policy calls a function);
--   * authenticated keeps EXECUTE only on functions it could already run (the RLS helpers
--     used inside policies, and the RPCs the app calls); functions that were deliberately
--     revoked (recompute_invoice, write_audit, ...) stay revoked;
--   * trigger functions cannot be called by API roles at all (triggers do not need it);
--   * functions owned by extensions (pg_trgm) are left alone;
--   * new functions get no PUBLIC grant by default, so each migration must grant explicitly.
-- =============================================================================

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig,
           p.prorettype = 'trigger'::regtype as is_trigger,
           has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
                      and d.objid = p.oid and d.deptype = 'e')
  loop
    -- record the current authenticated access as an explicit grant before PUBLIC is removed
    if f.authenticated_can and not f.is_trigger then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.is_trigger then
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- Advisor: fix role-mutable search_path on the remaining helper functions.
alter function public.set_updated_at() set search_path = public;
alter function public.request_header(text) set search_path = public;
alter function public.application_status_label(public.application_status) set search_path = public;
alter function public.sync_lesson_course() set search_path = public;
alter function public.on_task_change() set search_path = public;
alter function public.try_uuid(text) set search_path = public;
alter function public.path_segment(text, int) set search_path = public;
