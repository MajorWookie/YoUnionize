-- Sync Supabase auth.users → public.users on signup
-- This replaces the Better Auth databaseHooks.user.create.after hook.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, name, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    now(),
    now()
  );

  insert into public.user_profiles (user_id)
  values (new.id);

  return new;
end;
$$;

-- Fire after every new row in auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Enable the vector extension (idempotent)
create extension if not exists vector with schema extensions;
