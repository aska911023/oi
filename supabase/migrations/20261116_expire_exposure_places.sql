create or replace function public.revert_expired_exposure() returns void language sql security definer set search_path to 'public' as $$
  update public.stays      set ad_tier='free', featured=false, ad_start=null, ad_end=null where ad_end is not null and ad_end < current_date and ad_tier<>'free';
  update public.restaurants set ad_tier='free', featured=false, ad_start=null, ad_end=null where ad_end is not null and ad_end < current_date and ad_tier<>'free';
  update public.activities  set ad_tier='free', featured=false, ad_start=null, ad_end=null where ad_end is not null and ad_end < current_date and ad_tier<>'free';
  update public.caterings   set ad_tier='free', featured=false, ad_start=null, ad_end=null where ad_end is not null and ad_end < current_date and ad_tier<>'free';
$$;
select cron.alter_job(job_id := (select jobid from cron.job where jobname='oi-revert-expired-ad'), command := 'select public.revert_expired_exposure();');
