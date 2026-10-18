-- ============================================================================
-- OnMe · 0008 — llegadas: check-in del cliente con el QR fijo de barra
--
-- El cliente escanea el mismo QR estático del alta (/j/<shop>) con su móvil.
-- Si ya tiene tarjeta, en vez del formulario se registra una "llegada" y la
-- barra la ve en su lista: el barista toca el nombre y elige los cafés, sin
-- coger ningún móvil.
--
-- Una llegada NO sella nada. Solo avisa. El sello sigue saliendo del toque
-- del barista, que es quien ve a la persona delante -el QR es estático y se
-- puede fotografiar, así que por sí solo no prueba presencia-. Por eso
-- caduca en minutos y, si nadie la atiende, se queda como rastro: cuántas
-- llegadas caducan sin atender es la señal de que alguien abusa del cartel.
--
-- Historial append-only como `scans`: una fila por aviso, nunca se borra.
-- Un mismo cliente que reescanea con un aviso todavía vivo lo refresca en
-- vez de duplicarlo -ver lib/arrivals.ts-.
-- ============================================================================

create table arrivals (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  -- Cuándo se atendió -se selló o canjeó algo a ese cliente mientras el
  -- aviso estaba vivo-. NULL y caducada = nadie la atendió.
  handled_at   timestamptz
);

-- La lista de barra: avisos vivos de un local, por hora de llegada.
create index arrivals_shop_pending_ix on arrivals (shop_id, expires_at desc)
  where handled_at is null;
create index arrivals_customer_ix on arrivals (customer_id, created_at desc);

alter table arrivals enable row level security;
