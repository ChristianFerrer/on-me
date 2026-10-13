-- ============================================================================
-- OnMe · 0005 — apariencia del local: tema, estilo de tarjeta y logo
--
-- `shops_locale_ck` (migración 0001) solo dejaba 'es'/'en' aunque
-- lib/i18n ya soporta 'fr'/'de' desde antes de esta migración: nadie la
-- había actualizado al añadir esos dos idiomas. El nuevo selector de
-- "idioma por defecto" del panel de ajustes los ofrece los cuatro, así
-- que hace falta arreglarla aquí o guardar fr/de reventaría el check.
-- ============================================================================

alter table shops drop constraint shops_locale_ck;
alter table shops add constraint shops_locale_ck check (default_locale in ('es','en','fr','de'));

alter table shops add column theme text not null default 'dark';
alter table shops add constraint shops_theme_ck check (theme in ('dark','light'));

-- 'digital': el carrusel de siempre. 'real': el panel de progreso se
-- enseña como una copia de la tarjeta de cartón física del local -ver
-- RealStampCard.tsx-, logo y nombre incluidos.
alter table shops add column card_style text not null default 'digital';
alter table shops add constraint shops_card_style_ck check (card_style in ('digital','real'));

alter table shops add column logo_url text;

-- Bucket público para los logos subidos desde /admin/ajustes. Público de
-- verdad -no solo "legible con RLS"-: son imágenes de marca pensadas para
-- enseñarse en la tarjeta del cliente, no datos privados.
insert into storage.buckets (id, name, public)
values ('shop-logos', 'shop-logos', true)
on conflict (id) do nothing;
