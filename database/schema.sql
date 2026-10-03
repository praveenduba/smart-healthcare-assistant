
Schema · SQL
-- =====================================================================
-- Smart Healthcare Assistant  |  database/schema.sql
-- Creates all tables, indexes and the "new user" trigger.
-- Run this FIRST, then run policies.sql.
-- Safe to run more than once (uses IF NOT EXISTS where possible).
-- All data you add must be FICTIONAL demonstration data.
-- =====================================================================
 
-- ---------------------------------------------------------------------
-- 1. Custom types (fixed lists of allowed values)
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('patient', 'doctor', 'admin');
exception when duplicate_object then null; end $$;
 
do $$ begin
  create type public.appointment_status as enum
    ('pending', 'confirmed', 'rejected', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;
 
-- ---------------------------------------------------------------------
-- 2. Helper: automatically refresh "updated_at" on every update
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
 
-- ---------------------------------------------------------------------
-- 3. profiles  (one row per user, linked to Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text not null default '' check (char_length(full_name) <= 100),
  phone         text check (phone is null or phone ~ '^[0-9+() -]{7,20}$'),
  date_of_birth date,
  gender        text check (gender in ('female', 'male', 'other', 'prefer_not_to_say')),
  blood_group   text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  role          public.user_role not null default 'patient',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
 
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
 
-- When someone signs up, create their profile automatically.
-- IMPORTANT: the role is ALWAYS 'patient' here. Nothing the browser
-- sends can change that.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;
 
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
 
-- ---------------------------------------------------------------------
-- 4. doctor_profiles
--    full_name is stored here too, so patients can see doctor names
--    without being allowed to read other people's profiles.
-- ---------------------------------------------------------------------
create table if not exists public.doctor_profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.profiles(id) on delete cascade,
  full_name        text not null check (char_length(full_name) between 2 and 100),
  specialization   text not null,
  qualification    text,
  department       text,
  experience_years integer check (experience_years is null or experience_years between 0 and 70),
  bio              text check (bio is null or char_length(bio) <= 1000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
 
drop trigger if exists trg_doctor_profiles_updated_at on public.doctor_profiles;
create trigger trg_doctor_profiles_updated_at
  before update on public.doctor_profiles
  for each row execute function public.set_updated_at();
 
-- ---------------------------------------------------------------------
-- 5. doctor_availability  (weekly schedule; day_of_week 0=Sunday ... 6=Saturday)
-- ---------------------------------------------------------------------
create table if not exists public.doctor_availability (
  id           uuid primary key default gen_random_uuid(),
  doctor_id    uuid not null references public.doctor_profiles(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 10 and 120),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);
 
-- ---------------------------------------------------------------------
-- 6. appointments
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.profiles(id) on delete cascade,
  doctor_id        uuid not null references public.doctor_profiles(id) on delete restrict,
  appointment_date date not null,
  start_time       time not null,
  reason           text check (reason is null or char_length(reason) <= 500),
  status           public.appointment_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
 
-- Two active bookings can never share the same doctor/date/time.
create unique index if not exists uq_appointments_active_slot
  on public.appointments (doctor_id, appointment_date, start_time)
  where status in ('pending', 'confirmed');
 
drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();
 
-- ---------------------------------------------------------------------
-- 7. medicine_schedules  (entered by the patient; we never prescribe)
-- ---------------------------------------------------------------------
create table if not exists public.medicine_schedules (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references public.profiles(id) on delete cascade,
  medicine_name       text not null check (char_length(medicine_name) between 1 and 150),
  dosage_instructions text check (dosage_instructions is null or char_length(dosage_instructions) <= 500),
  reminder_times      time[] not null default '{}',
  start_date          date not null default current_date,
  end_date            date,
  reminder_enabled    boolean not null default true,
  notes               text check (notes is null or char_length(notes) <= 500),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
 
drop trigger if exists trg_medicine_schedules_updated_at on public.medicine_schedules;
create trigger trg_medicine_schedules_updated_at
  before update on public.medicine_schedules
  for each row execute function public.set_updated_at();
 
-- ---------------------------------------------------------------------
-- 8. medicine_logs  (reminder history: taken / skipped)
-- ---------------------------------------------------------------------
create table if not exists public.medicine_logs (
  id            uuid primary key default gen_random_uuid(),
  schedule_id   uuid not null references public.medicine_schedules(id) on delete cascade,
  patient_id    uuid not null references public.profiles(id) on delete cascade,
  scheduled_for timestamptz not null,
  status        text not null default 'taken' check (status in ('taken', 'skipped')),
  logged_at     timestamptz not null default now(),
  unique (schedule_id, scheduled_for)
);
 
-- ---------------------------------------------------------------------
-- 9. medicine_inventory  (hospital stock, managed by clerk/admin)
-- ---------------------------------------------------------------------
create table if not exists public.medicine_inventory (
  id                  uuid primary key default gen_random_uuid(),
  medicine_name       text not null check (char_length(medicine_name) between 1 and 150),
  category            text,
  unit                text not null default 'tablets',
  quantity            integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  expiry_date         date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
 
drop trigger if exists trg_medicine_inventory_updated_at on public.medicine_inventory;
create trigger trg_medicine_inventory_updated_at
  before update on public.medicine_inventory
  for each row execute function public.set_updated_at();
 
-- ---------------------------------------------------------------------
-- 10. medical_reports  (METADATA only; the file lives in private Storage)
-- ---------------------------------------------------------------------
create table if not exists public.medical_reports (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 150),
  category        text not null default 'other'
                  check (category in ('lab_report','prescription','imaging',
                                      'discharge_summary','vaccination','other')),
  description     text check (description is null or char_length(description) <= 500),
  file_path       text not null unique,
  file_type       text not null check (file_type in ('application/pdf','image/jpeg','image/png')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  uploaded_at     timestamptz not null default now()
);
 
-- ---------------------------------------------------------------------
-- 11. emergency_contacts
-- ---------------------------------------------------------------------
create table if not exists public.emergency_contacts (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.profiles(id) on delete cascade,
  contact_name text not null check (char_length(contact_name) between 1 and 100),
  relationship text,
  phone        text not null check (phone ~ '^[0-9+() -]{7,20}$'),
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
 
-- Only one primary contact per patient.
create unique index if not exists uq_emergency_one_primary
  on public.emergency_contacts (patient_id) where is_primary;
 
drop trigger if exists trg_emergency_contacts_updated_at on public.emergency_contacts;
create trigger trg_emergency_contacts_updated_at
  before update on public.emergency_contacts
  for each row execute function public.set_updated_at();
 
-- ---------------------------------------------------------------------
-- 12. notifications  (in-app)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  message    text,
  type       text not null default 'info',
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
 
-- ---------------------------------------------------------------------
-- 13. audit_logs  (who did what; written by triggers, readable by admins)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  action     text not null,
  table_name text not null,
  record_id  uuid,
  details    jsonb,
  created_at timestamptz not null default now()
);
 
-- ---------------------------------------------------------------------
-- 14. Indexes (make searches and joins fast)
-- ---------------------------------------------------------------------
create index if not exists idx_doctor_availability_doctor on public.doctor_availability (doctor_id);
create index if not exists idx_appointments_patient       on public.appointments (patient_id, appointment_date);
create index if not exists idx_appointments_doctor        on public.appointments (doctor_id, appointment_date);
create index if not exists idx_appointments_status        on public.appointments (status);
create index if not exists idx_medicine_schedules_patient on public.medicine_schedules (patient_id);
create index if not exists idx_medicine_logs_patient      on public.medicine_logs (patient_id, scheduled_for);
create index if not exists idx_medicine_logs_schedule     on public.medicine_logs (schedule_id);
create index if not exists idx_medical_reports_patient    on public.medical_reports (patient_id, uploaded_at desc);
create index if not exists idx_emergency_contacts_patient on public.emergency_contacts (patient_id);
create index if not exists idx_notifications_user         on public.notifications (user_id, is_read, created_at desc);
create index if not exists idx_audit_logs_created         on public.audit_logs (created_at desc);
create index if not exists idx_profiles_role              on public.profiles (role);
 
-- Done! Now run policies.sql
 
