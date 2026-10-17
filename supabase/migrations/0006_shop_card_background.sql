-- ============================================================================
-- OnMe · 0006 — fondo de la tarjeta de cliente en tema claro
--
-- 'lima': los mismos lavados de color -lima, turquesa, azul- que ya tenía
-- el fondo claro de /c. 'blanco': degradado de blanco a gris muy claro,
-- mismo patrón de focos radiales, sin color -ver [data-theme="light"]
-- .aurora en app/globals.css-. Solo se nota con theme='light': el tema
-- oscuro sigue fijo en su degradado de siempre.
-- ============================================================================

alter table shops add column card_background text not null default 'lima';
alter table shops add constraint shops_card_background_ck check (card_background in ('lima','blanco'));
