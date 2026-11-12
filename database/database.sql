create table public.perfiles(
  id bigint generated always as identity primary key,
  nombre text not null unique,
  enviar_avisos boolean not null default false,
  ver_casos boolean not null default false,
  editar_casos boolean not null default false,
  cambiar_estado boolean not null default false,
  exportar boolean not null default false,
  ver_historial boolean not null default false,
  creado_en timestamptz not null default now()
);

insert into public.perfiles(nombre, enviar_avisos)
values ('Jefe', true);

insert into public.perfiles(nombre,ver_casos,editar_casos,cambiar_estado,exportar, ver_historial)
values('Epidemiólogo', true,true,true,true,true);

create table public.cuentas(
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  perfil_id bigint not null references public.perfiles (id),
  es_admin boolean not null default false,
  activa boolean not null default true,
  correo text not null,
  -- VULN-015: si algún camino olvida debe_cambiar, la cuenta nueva igual tiene que cambiar su contraseña.
  debe_cambiar boolean not null default true,
  -- HU-02.1 y HU-02.6 (D43): la contraseña temporal vence a las 72 horas.
  clave_temporal_hasta timestamptz default (now() + interval '72 hours'),
  -- HU-02.4: cada cambio sube la versión, para notar si otra persona cambió la cuenta.
  version integer not null default 1,
  creado_en timestamptz not null default now()
);

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

alter table public.perfiles enable row level security;
alter table public.cuentas enable row level security;

-- VULN-016: con la llave publicable nadie escribe en estas tablas; solo se lee lo que dejan las reglas.
revoke all on public.perfiles, public.cuentas from anon, authenticated;
grant select on public.perfiles, public.cuentas to authenticated;

-- Las tablas que se creen después tampoco nacen abiertas para anon ni authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- VULN-010: solo una cuenta activa, que ya cambió su temporal, lee los perfiles.
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

create policy "las cuentas activas leen los perfiles"
on public.perfiles for select to authenticated
using ((select public.es_cuenta_activa()));

create policy "Cada quien lee lo suyo"
on public.cuentas for select to authenticated
using (id=(select auth.uid()));

create unique index cuentas_correo_unico on public.cuentas (lower(correo));

-- al desactivar una cuenta o restablecer una contraseña se cierran todas las sesiones
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