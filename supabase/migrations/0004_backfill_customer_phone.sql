-- ============================================================================
-- Backfill de customers.phone para los datos de demo del piloto.
--
-- Los ~128 clientes de antes de la migración 0003 solo tienen phone_hash
-- (irreversible) y phone_last4: su número real no se puede recuperar. Como
-- esta base es la del piloto/demo (ver seed.sql), se les asigna un móvil
-- español sintético -pero válido y único- para que la búsqueda del barista
-- por teléfono completo funcione con TODOS los clientes, no solo con los
-- dados de alta después de la 0003.
--
-- Formato: +346 + 4 dígitos de orden (únicos, evitan choques) + los 4
-- dígitos que ya tenía guardados en phone_last4, para que el número
-- sintético siga terminando en lo que ya se mostraba en el panel.
-- ============================================================================

with numbered as (
  select id, row_number() over (order by id) as rn
  from customers
  where phone is null
)
update customers c
set phone = '+346' || lpad(numbered.rn::text, 4, '0') || c.phone_last4
from numbered
where c.id = numbered.id;
