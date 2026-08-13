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
  | "invalid";

export type AttributionState = "window" | "billable" | "discarded";

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
  reward_pending: boolean;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
