-- ============================================================================
-- OnMe · invito yo — esquema inicial
--
-- Modelo de identidad ASIMÉTRICO:
--   · cliente  -> token opaco al portador (sin cuenta, sin login)
--   · barista  -> device token canjeado por sesión revocable + PIN de confirmación
--   · admin    -> Supabase Auth real (shop_members)
--
-- Toda escritura pasa por el servidor con service_role. RLS deniega todo
-- como red de seguridad: con la anon key no debe poder leerse nada.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- utilidad
-- `search_path` fijo a propósito: una función sin él puede acabar
-- resolviendo nombres contra un esquema que controle quien la invoque.
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------------ shops
create table shops (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,            -- 'madness'
  name                text not null,                   -- 'The Madness'
  address             text,
  hours               text,
  stamps_goal         int  not null default 10,
  invite_ttl_days     int  not null default 30,
  return_window_days  int  not null default 30,
  bonus_stamps        int  not null default 3,         -- premio al padrino
  max_active_invites  int  not null default 2,
  -- Barcelona es cosmopolita: el alta acepta teléfonos internacionales.
  -- Este prefijo solo se usa cuando el número llega sin '+'.
  default_country_code text not null default '+34',
  default_locale      text not null default 'es',
  timezone            text not null default 'Europe/Madrid',
  created_at          timestamptz not null default now(),
  constraint shops_locale_ck check (default_locale in ('es','en'))
);

-- ---------------------------------------------------------------- devices
-- Dispositivos autorizados del local. Su escaneo es la prueba de presencia
-- física, así que su token es el secreto más valioso del sistema.
create table devices (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id) on delete cascade,
  name          text not null,                       -- 'Barra 1'
  token         text not null unique,                -- opaco, 32 hex — llave de alta
  pin_hash      text,                                -- sha256(pin + APP_SALT), 4 dígitos
  active        bool not null default true,
  created_at    timestamptz not null default now()
);
create index devices_shop_ix on devices (shop_id);

-- -------------------------------------------------------- device_sessions
-- El device token se canjea UNA vez por una sesión larga en cookie httpOnly.
-- A partir de ahí la URL se limpia y el token no vuelve a viajar. Revocable
-- desde el panel si un iPad se pierde o alguien fotografía la barra.
create table device_sessions (
  id           uuid primary key default gen_random_uuid(),
  device_id    uuid not null references devices(id) on delete cascade,
  token_hash   text not null unique,                 -- sha256(session token + APP_SALT)
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);
create index device_sessions_device_ix on device_sessions (device_id, revoked_at);

-- ----------------------------------------------------------- shop_members
-- Admin real: usuarios de Supabase Auth con acceso a un local.
create table shop_members (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner',
  created_at timestamptz not null default now(),
  constraint shop_members_role_ck check (role in ('owner','operator')),
  constraint shop_members_uq unique (shop_id, user_id)
);
create index shop_members_user_ix on shop_members (user_id);

-- -------------------------------------------------------------- customers
create table customers (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  name         text not null,
  phone_hash   text not null,                        -- sha256(e164 + APP_SALT)
  phone_last4  text not null,                        -- para la búsqueda del barista
  token        text not null unique,                 -- identidad del cliente, 32 hex
  source       text not null default 'qr',           -- 'qr' | 'invitation'
  locale       text not null default 'es',
  created_at   timestamptz not null default now(),
  constraint customers_source_ck check (source in ('qr','invitation')),
  constraint customers_locale_ck check (locale in ('es','en'))
);
create unique index customers_shop_phone_uq on customers (shop_id, phone_hash);
create index customers_shop_last4_ix on customers (shop_id, phone_last4);

-- ----------------------------------------------------------------- passes
create table passes (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references customers(id) on delete cascade,
  stamps           int  not null default 0,
  cards_completed  int  not null default 0,
  reward_pending   bool not null default false,      -- café gratis sin canjear
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index passes_customer_uq on passes (customer_id);
create trigger passes_set_updated_at
  before update on passes
  for each row execute function set_updated_at();

-- ------------------------------------------------------------ invitations
create table invitations (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  padrino_id   uuid not null references customers(id) on delete cascade,
  code         text not null unique,                 -- 6 chars, alfabeto sin ambigüedad
  state        text not null default 'created',
  locale       text not null default 'es',           -- idioma del padrino al enviarla
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  opened_at    timestamptz,
  claimed_at   timestamptz,
  claimed_by   uuid references customers(id),
  redeemed_at  timestamptz,
  expires_at   timestamptz not null,
  constraint invitations_state_ck check (state in
    ('created','sent','opened','claimed','redeemed','expired','void')),
  constraint invitations_locale_ck check (locale in ('es','en'))
);
create index invitations_shop_state_ix on invitations (shop_id, state);
create index invitations_padrino_ix on invitations (padrino_id);
create index invitations_claimed_by_ix on invitations (claimed_by);

-- ------------------------------------------------------------------ scans
-- Registro inmutable. Nunca se borra ni se edita.
create table scans (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  device_id   uuid references devices(id),
  customer_id uuid references customers(id) on delete cascade,
  kind        text not null,
  manual      bool not null default false,           -- sellado por búsqueda, no por QR
  duration_ms int,                                   -- de apertura de cámara a resultado
  created_at  timestamptz not null default now(),
  constraint scans_kind_ck check (kind in
    ('stamp','redeem_reward','redeem_invitation','duplicate','invalid'))
);
create index scans_shop_created_ix on scans (shop_id, created_at desc);
create index scans_customer_ix on scans (customer_id, created_at desc);
create index scans_device_created_ix on scans (device_id, created_at desc);

-- ----------------------------------------------------------- attributions
-- Tabla de facturación y auditoría. Append-only: nunca se borra una fila.
create table attributions (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references shops(id) on delete cascade,
  invitation_id  uuid not null references invitations(id) on delete cascade,
  padrino_id     uuid not null references customers(id),
  ahijado_id     uuid not null references customers(id),
  redeemed_at    timestamptz not null,
  redeem_scan_id uuid not null references scans(id),
  returned_at    timestamptz,
  return_scan_id uuid references scans(id),
  billable       bool not null default false,
  state          text not null default 'window',
  disputed       bool not null default false,
  bonus_paid     bool not null default false,
  created_at     timestamptz not null default now(),
  constraint attributions_state_ck check (state in ('window','billable','discarded'))
);
create unique index attributions_invitation_uq on attributions (invitation_id);
create index attributions_shop_state_ix on attributions (shop_id, state);

-- -------------------------------------------------------------------- RLS
-- Denegar todo. El acceso es exclusivamente server-side con service_role,
-- que ignora RLS por diseño. Sin políticas = nadie con anon key lee ni escribe.
alter table shops           enable row level security;
alter table devices         enable row level security;
alter table device_sessions enable row level security;
alter table shop_members    enable row level security;
alter table customers       enable row level security;
alter table passes          enable row level security;
alter table invitations     enable row level security;
alter table scans           enable row level security;
alter table attributions    enable row level security;
