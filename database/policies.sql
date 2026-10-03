-- =====================================================================
-- Smart Healthcare Assistant  |  database/policies.sql
-- Security: helper functions, guard triggers, Row Level Security (RLS)
-- policies, and the PRIVATE storage bucket for medical reports.
-- Run this AFTER schema.sql. Safe to run more than once.
--
-- Design rules:
--   * Patients: only their own rows.
--   * Doctors : only their own schedule and their own appointments
--               (plus the basic profile of patients who booked them).
--   * Admins  : users, doctors, appointments, inventory, audit logs.
--               Admins CANNOT read medicine schedules or medical reports.
--   * Roles cannot be self-assigned from the browser.
-- =====================================================================
 
-- ---------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER = they run with owner rights so
--    policies can check roles without causing infinite loops)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())) = 'admin',
    false);
$$;