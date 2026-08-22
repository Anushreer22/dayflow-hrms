-- Phase 8: Seed data for Dayflow

-- Note: auth.users entries are not created here; this assumes you have already created auth users for admin and employees.
-- If not, create them via Supabase Authentication UI first, then map their IDs below.
-- Alternatively, you can use the Supabase admin API to create users with known IDs.

-- Replace the UUIDs below with your actual auth.users IDs after creating users.

-- Admin profile (if not exists)
insert into public.users (id, login_id, email, role, joining_year, must_change_password)
values ('00000000-0000-0000-0000-000000000001', 'OIJADMI20260000', 'admin@dayflow.com', 'admin', 2026, false)
on conflict (id) do nothing;

insert into public.profiles (user_id, full_name, job_position, department, date_of_joining)
values ('00000000-0000-0000-0000-000000000001', 'Admin User', 'HR Manager', 'HR', current_date)
on conflict (user_id) do nothing;

-- Employees
insert into public.users (id, login_id, email, role, joining_year, must_change_password)
values
  ('00000000-0000-0000-0000-000000000101', 'OIJEMDO20260001', 'emma.doe@dayflow.com', 'employee', 2026, false),
  ('00000000-0000-0000-0000-000000000102', 'OIJLIRO20260002', 'liam.ross@dayflow.com', 'employee', 2026, false),
  ('00000000-0000-0000-0000-000000000103', 'OIJNOAL20260003', 'nora.ali@dayflow.com', 'employee', 2026, false),
  ('00000000-0000-0000-0000-000000000104', 'OIJRACH20260004', 'raj.ch@dayflow.com', 'employee', 2026, false),
  ('00000000-0000-0000-0000-000000000105', 'OIJSOLE20260005', 'sofia.lee@dayflow.com', 'employee', 2026, false)
on conflict (id) do nothing;

insert into public.profiles (user_id, full_name, job_position, department, date_of_joining)
values
  ('00000000-0000-0000-0000-000000000101', 'Emma Doe', 'Software Engineer', 'Engineering', current_date - interval '1 year'),
  ('00000000-0000-0000-0000-000000000102', 'Liam Ross', 'Accountant', 'Finance', current_date - interval '1 year'),
  ('00000000-0000-0000-0000-000000000103', 'Nora Ali', 'HR Specialist', 'HR', current_date - interval '1 year'),
  ('00000000-0000-0000-0000-000000000104', 'Raj Ch', 'Marketing Lead', 'Marketing', current_date - interval '1 year'),
  ('00000000-0000-0000-0000-000000000105', 'Sofia Lee', 'Sales Rep', 'Sales', current_date - interval '1 year')
on conflict (user_id) do nothing;

-- Salary structures
insert into public.salary_structures (user_id, wage_monthly, effective_from)
values
  ('00000000-0000-0000-0000-000000000101', 50000, current_date - interval '1 year'),
  ('00000000-0000-0000-0000-000000000102', 45000, current_date - interval '1 year'),
  ('00000000-0000-0000-0000-000000000103', 55000, current_date - interval '1 year'),
  ('00000000-0000-0000-0000-000000000104', 60000, current_date - interval '1 year'),
  ('00000000-0000-0000-0000-000000000105', 48000, current_date - interval '1 year')
on conflict (user_id) do nothing;

-- Attendance (last 2 weeks; note: unique(user_id, date) must not conflict)
insert into public.attendance (user_id, date, status, check_in, check_out, work_hours, extra_hours)
select
  u.id,
  d::date,
  case when (d::date = current_date and extract(dow from d) in (1,2,3,4,5)) then 'present'
       when extract(dow from d) in (6,0) then 'leave'
       else 'present' end,
  case when (extract(dow from d) in (6,0)) then null else (d::date + interval '9 hours')::timestamptz end,
  case when (extract(dow from d) in (6,0)) then null else (d::date + interval '17 hours')::timestamptz end,
  case when (extract(dow from d) in (6,0)) then null else 8.0 end,
  case when (extract(dow from d) in (6,0)) then null else 0.0 end
from generate_series(current_date - interval '14 days', current_date, interval '1 day') d
cross join public.users u
where u.role = 'employee'
  and not exists (
    select 1 from public.attendance a
    where a.user_id = u.id and a.date = d::date
  );

-- Leave requests
insert into public.leave_requests (user_id, leave_type, start_date, end_date, allocation_days, status, reviewer_comments, reviewed_by)
values
  ('00000000-0000-0000-0000-000000000101', 'paid', current_date - interval '10 days', current_date - interval '8 days', 3, 'approved', 'Approved', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000102', 'sick', current_date - interval '5 days', current_date - interval '4 days', 2, 'approved', 'Get well soon', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000103', 'paid', current_date + interval '2 days', current_date + interval '3 days', 2, 'pending', null, null),
  ('00000000-0000-0000-0000-000000000104', 'unpaid', current_date - interval '2 days', current_date - interval '1 day', 2, 'rejected', 'Not eligible', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Notifications
insert into public.notifications (user_id, title, body, is_read)
values
  ('00000000-0000-0000-0000-000000000101', 'Leave approved', 'Your paid leave request has been approved.', false),
  ('00000000-0000-0000-0000-000000000102', 'Attendance reminder', 'Please remember to check in.', false),
  ('00000000-0000-0000-0000-000000000103', 'New policy', 'Updated HR policies are available.', true)
on conflict do nothing;