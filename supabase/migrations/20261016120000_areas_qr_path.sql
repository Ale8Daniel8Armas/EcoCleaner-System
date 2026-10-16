begin;
-- Ruta relativa del QR de cada área (p. ej. /areas/<id>).
-- El enlace absoluto se compone con el origen actual en el frontend.
alter table areas
add column qr_path text generated always as ('/areas/' || id::text) stored;
comment on column areas.qr_path is 'Ruta relativa del QR del área; el absoluto se compone con el origen actual';
commit;
