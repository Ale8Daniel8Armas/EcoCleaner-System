-- Migración: Crear tabla de usuarios para autenticación y roles de EcoCleaner
create table if not exists usuarios (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    username text not null unique,
    password_hash text not null,
    rol text not null check (rol in ('operario', 'supervisor')),
    nombre text not null,
    created_at timestamp with time zone default now()
);

-- Políticas RLS
alter table usuarios enable row level security;

-- Política para permitir autenticación, consulta y registro en el entorno de la aplicación
create policy "Acceso público usuarios demo"
    on usuarios for all
    using (true)
    with check (true);

-- Semilla inicial de usuarios
insert into usuarios (email, username, password_hash, rol, nombre)
values
    ('operario@ecocleaner.com', 'operario', 'operario123', 'operario', 'Operario Principal'),
    ('supervisor@ecocleaner.com', 'supervisor', 'supervisor123', 'supervisor', 'Supervisor de Planta')
on conflict (email) do nothing;
