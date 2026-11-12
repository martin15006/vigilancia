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

-- ===== Enmienda 5 ·  parte 1 =====

--si algún camino olvida debe_cambiar, la cuenta nueva igual tiene que cambiar su contraseña.
alter table public.cuentas
alter column debe_cambiar set default true;

--la contraseña temporal vence a las 72 horas.
alter table public.cuentas
add column clave_temporal_hasta timestamptz default (now() + interval '72 hours');

-- Las cuentas que ya cambiaron su contraseña no tienen temporal que venza.
update public.cuentas
set clave_temporal_hasta = null
where debe_cambiar = false;

--cada cambio de una cuenta sube su versión. Así se nota si otra persona la cambió mientras se editaba.
alter table public.cuentas
add column version integer not null default 1;

create or replace function public.subir_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger cuentas_subir_version
before update on public.cuentas
for each row execute function public.subir_version();

-- con la llave publicable nadie escribe en estas tablas; solo se lee lo que dejan las reglas.
revoke all on public.perfiles, public.cuentas from anon, authenticated;
grant select on public.perfiles, public.cuentas to authenticated;

-- Las tablas que se creen después tampoco nacen abiertas para anon ni authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- solo una cuenta activa, que ya cambió su temporal, lee los perfiles.
create or replace function public.es_cuenta_activa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cuentas c
    where c.id = (select auth.uid()) and c.activa and not c.debe_cambiar
  );
$$;

revoke execute on function public.es_cuenta_activa() from public, anon;
grant execute on function public.es_cuenta_activa() to authenticated;

drop policy "con sesión se leen los perfiles" on public.perfiles;

create policy "las cuentas activas leen los perfiles"
on public.perfiles for select to authenticated
using ((select public.es_cuenta_activa()));

-- HU-02.9 (D42): el registro de lo que pasa con las cuentas. Solo se agrega: no se cambia ni se borra.
create table public.eventos (
  id bigint generated always as identity primary key,
  en timestamptz not null default now(),
  quien uuid,
  accion text not null check (accion in (
    'crear', 'editar', 'activar', 'desactivar', 'restablecer',
    'cambiar_clave', 'entrada', 'entrada_fallida', 'entrada_frenada'
  )),
  cuenta uuid,
  detalle jsonb not null default '{}'::jsonb
);

alter table public.eventos enable row level security;
revoke all on public.eventos from anon, authenticated;

create or replace function public.eventos_no_se_cambian()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'El registro de eventos no se puede cambiar ni borrar.';
end;
$$;

create trigger eventos_sin_cambios
before update or delete on public.eventos
for each row execute function public.eventos_no_se_cambian();

create trigger eventos_sin_vaciar
before truncate on public.eventos
for each statement execute function public.eventos_no_se_cambian();
