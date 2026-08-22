-- Dayflow HRMS core schema
-- Phase 1.1: Tables only, no RLS policies yet

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique,
  email text not null unique,
  role text not null check (role in ('admin','employee')),
  employee_code text unique,
  joining_year int not null,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  full_name text not null,
  phone text,
  address text,
  profile_picture_url text,
  job_position text,
  department text,
  manager_id uuid references public.users(id) on delete set null,
  location text,
  date_of_birth date,
  nationality text,
  gender text,
  marital_status text,
  personal_email text,
  date_of_joining date not null,
  bank_account_number text,
  bank_name text,
  ifsc_code text,
  uan_no text,
  pan_no text,
  resume_url text,
  about text,
  skills text[],
  updated_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent','half_day','leave')),
  check_in timestamptz,
  check_out timestamptz,
  work_hours numeric,
  extra_hours numeric,
  created_at timestamptz not null default now(),
  constraint unique_user_date unique (user_id, date)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  leave_type text not null check (leave_type in ('paid','sick','unpaid')),
  start_date date not null,
  end_date date not null,
  allocation_days numeric not null,
  remarks text,
  attachment_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_comments text,
  reviewed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint leave_dates_valid check (end_date >= start_date)
);

create table public.salary_structures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  wage_monthly numeric not null,
  basic numeric not null,
  hra numeric not null,
  standard_allowance numeric not null,
  performance_bonus numeric not null,
  lta numeric not null,
  fixed_allowance numeric not null,
  pf_employee numeric not null,
  pf_employer numeric not null,
  professional_tax numeric not null default 200,
  effective_from date not null,
  updated_at timestamptz not null default now(),
  constraint salary_total_check check (
    (basic + hra + standard_allowance + performance_bonus + lta + fixed_allowance) <= wage_monthly
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);