-- Dayflow HRMS: Wage-based salary auto-calculation
-- Phase 4: Function + trigger so salary_structures components are always derived.

create or replace function public.calculate_salary_components(wage numeric, effective_from date)
returns table (
  basic numeric,
  hra numeric,
  standard_allowance numeric,
  performance_bonus numeric,
  lta numeric,
  fixed_allowance numeric,
  pf_employee numeric,
  pf_employer numeric,
  professional_tax numeric
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_basic numeric;
  v_hra numeric;
  v_std numeric := 4167;
  v_perf numeric;
  v_lta numeric;
  v_fixed numeric;
  v_pf numeric;
  v_earnings numeric;
begin
  if wage is null then
    raise exception 'wage is required';
  end if;

  -- effective_from is part of the public signature (period-aware rules can use it later)
  if effective_from is null then
    null;
  end if;

  v_basic := round(wage * 0.50, 2);
  v_hra := round(v_basic * 0.50, 2);
  v_perf := round(v_basic * 8.33 / 100, 2);
  v_lta := round(v_basic * 8.33 / 100, 2);
  v_earnings := v_basic + v_hra + v_std + v_perf + v_lta;
  v_fixed := round(wage - v_earnings, 2);

  if v_fixed < 0 then
    v_fixed := 0;
    if v_earnings > wage then
      raise exception 'Wage is too low to cover calculated salary components.';
    end if;
  end if;

  if (v_basic + v_hra + v_std + v_perf + v_lta + v_fixed) > wage then
    raise exception 'Calculated salary components exceed wage.';
  end if;

  v_pf := round(v_basic * 12 / 100, 2);

  basic := v_basic;
  hra := v_hra;
  standard_allowance := v_std;
  performance_bonus := v_perf;
  lta := v_lta;
  fixed_allowance := v_fixed;
  pf_employee := v_pf;
  pf_employer := v_pf;
  professional_tax := 200;
  return next;
end;
$$;

revoke all on function public.calculate_salary_components(numeric, date) from public;
grant execute on function public.calculate_salary_components(numeric, date) to authenticated;
grant execute on function public.calculate_salary_components(numeric, date) to service_role;

create or replace function public.apply_salary_structure_components()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  calc record;
begin
  select * into calc
  from public.calculate_salary_components(new.wage_monthly, new.effective_from);

  -- Always overwrite component columns so client-supplied values cannot stick.
  new.basic := calc.basic;
  new.hra := calc.hra;
  new.standard_allowance := calc.standard_allowance;
  new.performance_bonus := calc.performance_bonus;
  new.lta := calc.lta;
  new.fixed_allowance := calc.fixed_allowance;
  new.pf_employee := calc.pf_employee;
  new.pf_employer := calc.pf_employer;
  new.professional_tax := calc.professional_tax;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_apply_salary_structure_components on public.salary_structures;
create trigger trg_apply_salary_structure_components
before insert or update on public.salary_structures
for each row execute function public.apply_salary_structure_components();
