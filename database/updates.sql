alter table public.cuentas
add column correo text;

alter table public.cuentas
add column debe_cambiar boolean not null default false;

update public.cuentas c
set
  correo = u.email
from
  auth.users u
where
  u.id = c.id;

alter table public.cuentas
alter column correo
set not null;

create unique index cuentas_correo_unico on public.cuentas (lower(correo));

create or replace function public.cerrar_sesiones(p_usuario uuid)
returns void
language sql
security definer
set search_path = ''
as $$ 
  delete from auth.sessions where user_id = p_usuario;
  $$;

revoke execute on function public.cerrar_sesiones(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones(uuid) to service_role;