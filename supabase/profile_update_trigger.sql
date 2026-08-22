-- Dayflow HRMS: Restrict profile updates by role
-- Phase 3: Employees can update only phone, address, profile_picture_url.
-- Admins can update all fields.

create or replace function public.enforce_profile_update_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if (new.full_name is distinct from old.full_name)
       or (new.job_position is distinct from old.job_position)
       or (new.department is distinct from old.department)
       or (new.manager_id is distinct from old.manager_id)
       or (new.location is distinct from old.location)
       or (new.date_of_birth is distinct from old.date_of_birth)
       or (new.nationality is distinct from old.nationality)
       or (new.gender is distinct from old.gender)
       or (new.marital_status is distinct from old.marital_status)
       or (new.personal_email is distinct from old.personal_email)
       or (new.date_of_joining is distinct from old.date_of_joining)
       or (new.bank_account_number is distinct from old.bank_account_number)
       or (new.bank_name is distinct from old.bank_name)
       or (new.ifsc_code is distinct from old.ifsc_code)
       or (new.uan_no is distinct from old.uan_no)
       or (new.pan_no is distinct from old.pan_no)
       or (new.resume_url is distinct from old.resume_url)
       or (new.about is distinct from old.about)
       or (new.skills is distinct from old.skills)
    then
      raise exception 'Employees can only update phone, address, and profile picture.';
    end if;
  end if;

  -- Always refresh updated_at
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update_restrictions on public.profiles;
create trigger trg_enforce_profile_update_restrictions
before update on public.profiles
for each row execute function public.enforce_profile_update_restrictions();