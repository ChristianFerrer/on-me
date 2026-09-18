-- ============================================================================
-- OnMe · 0002 — cafés gratis acumulables + escaneo del modo identificador
--
-- `passes.reward_pending` era un booleano: como mucho un café gratis
-- pendiente a la vez, y el propio `decideScan` bloqueaba sellar más hasta
-- canjearlo. El flujo identificador de barra deja que se acumulen -alguien
-- completa dos tarjetas sin pasar nunca a canjear- y que el cliente elija
-- cuándo se los lleva, así que pasa a ser un contador.
--
-- `true`/`false` se convierten en `1`/`0` con el propio cast de Postgres
-- -no hace falta un `case`-, así que no hay filas que revisar a mano.
-- ============================================================================

alter table passes alter column reward_pending drop default;
alter table passes alter column reward_pending type int using reward_pending::int;
alter table passes alter column reward_pending set default 0;
alter table passes rename column reward_pending to reward_pending_count;
alter table passes add constraint passes_reward_pending_count_ck check (reward_pending_count >= 0);

-- 'identify': escaneo del modo identificador que solo consulta el perfil
-- del cliente -no sella ni canjea nada-, para poder medir cuánto se usa sin
-- mezclarlo con sellos ni canjes reales en las métricas existentes.
alter table scans drop constraint scans_kind_ck;
alter table scans add constraint scans_kind_ck check (kind in
  ('stamp','redeem_reward','redeem_invitation','duplicate','invalid','identify'));
