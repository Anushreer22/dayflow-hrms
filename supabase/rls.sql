-- Dayflow HRMS row-level security
-- Phase 1.2: Enable RLS and define policies for all tables

-- Helper functions (security definer to bypass RLS)
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.salary_structures enable row level security;
alter table public.notifications enable row level security;

-- ============ users ============
create policy "Users select own or admin all"
  on public.users for select
  using (id = auth.uid() or public.is_admin());

create policy "Admins insert users"
  on public.users for insert
  with check (public.is_admin());

create policy "Users update own or admin all"
  on public.users for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "Admins delete users"
  on public.users for delete
  using (public.is_admin());

-- ============ profiles ============
create policy "Profiles select own or admin all"
  on public.profiles for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins insert profiles"
  on public.profiles for insert
  with check (public.is_admin());

create policy "Profiles update own or admin all"
  on public.profiles for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "Admins delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- ============ attendance ============
create policy "Attendance select own or admin all"
  on public.attendance for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Attendance insert own or admin"
  on public.attendance for insert
  with check (user_id = auth.uid() or public.is_admin());

create policy "Attendance update own or admin all"
  on public.attendance for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "Admins delete attendance"
  on public.attendance for delete
  using (public.is_admin());

-- ============ leave_requests ============
create policy "Leave select own or admin all"
  on public.leave_requests for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Leave insert own or admin"
  on public.leave_requests for insert
  with check (user_id = auth.uid() or public.is_admin());

create policy "Leave update own or admin all"
  on public.leave_requests for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "Admins delete leave requests"
  on public.leave_requests for delete
  using (public.is_admin());

-- ============ salary_structures ============
create policy "Salary select own or admin all"
  on public.salary_structures for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins insert salary"
  on public.salary_structures for insert
  with check (public.is_admin());

create policy "Admins update salary"
  on public.salary_structures for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete salary"
  on public.salary_structures for delete
  using (public.is_admin());

-- ============ notifications ============
create policy "Notifications select own or admin all"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins insert notifications"
  on public.notifications for insert
  with check (public.is_admin());

create policy "Notifications update own or admin all"
  on public.notifications for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "Admins delete notifications"
  on public.notifications for delete
  using (public.is_admin());