-- ============================================================================
-- OnMe · 0007 — tercera opción de fondo claro: 'vivo'
--
-- La migración 0006 solo dejaba 'lima'/'blanco'. 'vivo' es el degradado
-- saturado de siempre -el mismo que usa el tema oscuro-, guardado como
-- una tercera opción elegible también con tema claro, ver ShopCardBackground
-- en lib/db/types.ts.
-- ============================================================================

alter table shops drop constraint shops_card_background_ck;
alter table shops add constraint shops_card_background_ck check (card_background in ('lima','blanco','vivo'));
