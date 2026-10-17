import type { Locale } from "@/lib/i18n";

export type InvitationState =
  | "created"
  | "sent"
  | "opened"
  | "claimed"
  | "redeemed"
  | "expired"
  | "void";

export type ScanKind =
  | "stamp"
  | "redeem_reward"
  | "redeem_invitation"
  | "duplicate"
  | "invalid"
  /** Flujo identificador: solo consulta el perfil, no sella ni canjea nada. */
  | "identify";

export type AttributionState = "window" | "billable" | "discarded";

export type ShopTheme = "dark" | "light";
/** 'digital': el carrusel de siempre. 'real': copia de la tarjeta de cartón física, ver RealStampCard.tsx. */
export type ShopCardStyle = "digital" | "real";
/**
 * Fondo de /c en tema claro -ver .aurora[data-theme="light"][data-bg="…"]
 * en globals.css-: 'lima' es el lavado pastel de lima/turquesa/azul,
 * 'blanco' el degradado de blanco a gris muy claro -mismo patrón de
 * focos radiales que los otros dos, sin color-, 'vivo' el degradado
 * saturado de siempre -el mismo que usa el tema oscuro-, elegible
 * también con tema claro. En tema oscuro no se nota -el oscuro sigue
 * fijo en su degradado de siempre-, así que el selector solo importa
 * junto a `theme: 'light'`.
 */
export type ShopCardBackground = "lima" | "blanco" | "vivo";

export type ShopRow = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  hours: string | null;
  stamps_goal: number;
  invite_ttl_days: number;
  return_window_days: number;
  bonus_stamps: number;
  max_active_invites: number;
  default_country_code: string;
  default_locale: Locale;
  timezone: string;
  /** Tope de cafés que el flujo identificador deja dar de una vez, ver /admin/ajustes. */
  max_stamps_per_scan: number;
  theme: ShopTheme;
  card_style: ShopCardStyle;
  card_background: ShopCardBackground;
  logo_url: string | null;
  created_at: string;
};

export type DeviceRow = {
  id: string;
  shop_id: string;
  name: string;
  token: string;
  pin_hash: string | null;
  active: boolean;
  created_at: string;
};

export type DeviceSessionRow = {
  id: string;
  device_id: string;
  token_hash: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

export type ShopMemberRow = {
  id: string;
  shop_id: string;
  user_id: string;
  role: "owner" | "operator";
  created_at: string;
};

export type CustomerRow = {
  id: string;
  shop_id: string;
  name: string;
  phone_hash: string;
  phone_last4: string;
  /**
   * E.164 completo, en claro -desde la migración 0003-. `null` en los
   * clientes dados de alta antes de ese cambio: su hash no se puede
   * deshacer, así que su número completo no se puede recuperar.
   */
  phone: string | null;
  token: string;
  source: "qr" | "invitation";
  locale: Locale;
  created_at: string;
};

export type PassRow = {
  id: string;
  customer_id: string;
  stamps: number;
  cards_completed: number;
  /** Cafés gratis completados y sin canjear todavía -pueden acumularse más de uno-. */
  reward_pending_count: number;
  created_at: string;
  updated_at: string;
};

export type InvitationRow = {
  id: string;
  shop_id: string;
  padrino_id: string;
  code: string;
  state: InvitationState;
  locale: Locale;
  created_at: string;
  sent_at: string | null;
  opened_at: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
  redeemed_at: string | null;
  expires_at: string;
};

export type ScanRow = {
  id: string;
  shop_id: string;
  device_id: string | null;
  customer_id: string | null;
  kind: ScanKind;
  manual: boolean;
  duration_ms: number | null;
  created_at: string;
};

export type AttributionRow = {
  id: string;
  shop_id: string;
  invitation_id: string;
  padrino_id: string;
  ahijado_id: string;
  redeemed_at: string;
  redeem_scan_id: string;
  returned_at: string | null;
  return_scan_id: string | null;
  billable: boolean;
  state: AttributionState;
  disputed: boolean;
  bonus_paid: boolean;
  created_at: string;
};

/** Check-in del cliente con el QR fijo de barra, ver migración 0008 y lib/arrivals.ts. */
export type ArrivalRow = {
  id: string;
  shop_id: string;
  customer_id: string;
  created_at: string;
  expires_at: string;
  handled_at: string | null;
};

/** Forma que espera supabase-js para tipar consultas de punta a punta. */
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      shops: Table<ShopRow>;
      devices: Table<DeviceRow>;
      device_sessions: Table<DeviceSessionRow>;
      shop_members: Table<ShopMemberRow>;
      customers: Table<CustomerRow>;
      passes: Table<PassRow>;
      invitations: Table<InvitationRow>;
      scans: Table<ScanRow>;
      attributions: Table<AttributionRow>;
      arrivals: Table<ArrivalRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
