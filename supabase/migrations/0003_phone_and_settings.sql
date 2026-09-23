-- ============================================================================
-- OnMe · 0003 — teléfono completo en claro + tope de sellos configurable
--
-- El teléfono completo pasa a guardarse en claro (`customers.phone`), para
-- poder usarlo como identificador de verdad en la búsqueda de barra -antes
-- solo vivía su hash, así que la búsqueda no podía distinguir "no es
-- cliente" de "lo escribiste con un formato distinto al del alta"-.
--
-- No se toca `phone_hash` ni `phone_last4`: siguen siendo la llave única
-- por local y el dato que ya se enseña en pantalla. Los clientes dados de
-- alta antes de esta migración se quedan con `phone` a NULL -el hash no se
-- puede deshacer, así que su número completo no se puede recuperar-; solo
-- los clientes nuevos, de aquí en adelante, lo tienen.
-- ============================================================================

alter table customers add column phone text;

-- Tope de cafés que el barista puede dar de una vez desde el flujo
-- identificador -ver Scanner.tsx/CustomerProfilePanel.tsx-, configurable
-- por local desde /admin/ajustes en vez de fijo en el código.
alter table shops add column max_stamps_per_scan int not null default 5;
alter table shops add constraint shops_max_stamps_per_scan_ck
  check (max_stamps_per_scan between 1 and 20);
