-- Dayflow HRMS: Login ID auto-generation
-- Phase 1.3: Generate login IDs in format [prefix][2 first][2 last][year][4-digit serial]

create or replace function public.generate_login_id(
  p_company_prefix text,
  p_first_name text,
  p_last_name text,
  p_joining_year int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_first2 text;
  v_last2 text;
  v_year text;
  v_base text;
  v_serial int;
  v_login_id text;
begin
  -- Clean and uppercase the name pieces
  v_first2 := upper(substring(regexp_replace(p_first_name, '[^a-zA-Z]', '', 'g') from 1 for 2));
  v_last2 := upper(substring(regexp_replace(p_last_name, '[^a-zA-Z]', '', 'g') from 1 for 2));
  v_year := p_joining_year::text;
  v_prefix := upper(p_company_prefix);

  if length(v_first2) < 2 or length(v_last2) < 2 then
    raise exception 'First and last name must each contain at least 2 letters';
  end if;

  v_base := v_prefix || v_first2 || v_last2 || v_year;

  -- Lock against concurrent generation for the same base
  perform pg_advisory_xact_lock(hashtext(v_base));

  -- Find the next serial number for this base
  select coalesce(max(right(login_id, 4)::int), 0) + 1
    into v_serial
  from public.users
  where login_id like v_base || '%';

  v_login_id := v_base || lpad(v_serial::text, 4, '0');

  return v_login_id;
end;
$$;

-- Only authenticated users can call this function; anonymous is denied
grant execute on function public.generate_login_id(text, text, text, int) to authenticated;