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
  debe_cambiar boolean not null default false,
  creado_en timestamptz not null default now()
);

alter table public.perfiles enable row level security;
alter table public.cuentas enable row level security;

create policy "con sesión se leen los perfiles"
on public.perfiles for select to authenticated
using (true);

create policy "Cada quien lee lo suyo"
on public.cuentas for select to authenticated
using (id=(select auth.uid()));

grant select on public.perfiles, public.cuentas to authenticated;

create unique index cuentas_correo_unico on public.cuentas (lower(correo));