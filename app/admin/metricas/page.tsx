import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/admin/BottomNav";
import { BarHistogram } from "@/components/admin/metrics/BarHistogram";
import { BulletGate } from "@/components/admin/metrics/BulletGate";
import { Cascade } from "@/components/admin/metrics/Cascade";
import { CohortGrid } from "@/components/admin/metrics/CohortGrid";
import { ComparisonRows } from "@/components/admin/metrics/ComparisonRows";
import { CycleVelocity } from "@/components/admin/metrics/CycleVelocity";
import { IntegrityBanner } from "@/components/admin/metrics/IntegrityBanner";
import { InviteWaffle } from "@/components/admin/metrics/InviteWaffle";
import { KpiCard } from "@/components/admin/metrics/KpiCard";
import { PadrinoTable } from "@/components/admin/metrics/PadrinoTable";
import { TodoSection } from "@/components/admin/metrics/TodoList";
import { HomeIcon, ShieldIcon } from "@/components/ui/Icons";
import { Screen } from "@/components/ui/Screen";
import { getAdminContext } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { fill } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { loadMetricsPage, MIN_SAMPLE, type MetricsRange, type WaffleGroupKey } from "@/lib/metrics";

const RANGES: MetricsRange[] = ["7d", "30d", "all"];

function parseRange(value: string | undefined): MetricsRange {
  return value === "7d" || value === "all" ? value : "30d";
}

/**
 * Métricas, según la especificación acordada: todo lo que se ve sale de
 * datos registrados -sellos, altas, invitaciones-, nada configurado a mano,
 * ningún importe. Si un dato no se puede calcular con lo que hay, no se
 * muestra -se marca "muestra insuficiente"-.
 *
 * Botones de WhatsApp en §9 siempre deshabilitados: OnMe no guarda todavía
 * ningún consentimiento de contacto comercial -el único consentimiento que
 * existe es para el tratamiento de datos de la tarjeta, una base legal
 * distinta-, así que no se envía nada hasta que ese campo exista.
 */
export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/constelacion-sol?session=expired");

  const { range: rawRange } = await searchParams;
  const range = parseRange(rawRange);

  const { t } = await getI18n();
  const m = t.metrics;
  const data = await loadMetricsPage(ctx.shop.id, ctx.shop.return_window_days, range);

  const integrityMessages = [
    data.integrity.invitesExceedCards ? m.integrityInvites : null,
    data.integrity.redeemsExceedOpened ? m.integrityRedeems : null,
    data.integrity.returnsExceedRedeems ? m.integrityReturns : null,
  ].filter((msg): msg is string => msg !== null);

  const pct = (r: { value: number | null }) => (r.value === null ? null : `${Math.round(r.value * 100)}%`);
  const dec = (r: { value: number | null }) => (r.value === null ? null : r.value.toFixed(1));
  const formula = (r: { numerator: number; denominator: number }) => `${r.numerator} ÷ ${r.denominator}`;

  const waffleLabels: Record<WaffleGroupKey, string> = {
    unopened_alive: m.waffleUnopenedAlive,
    expired_unopened: m.waffleExpiredUnopened,
    opened_unredeemed: m.waffleOpenedUnredeemed,
    expired_after_open: m.waffleExpiredAfterOpen,
    redeemed_window: m.waffleRedeemedWindow,
    redeemed_no_return: m.waffleRedeemedNoReturn,
    stayed: m.waffleStayed,
  };

  const headline = fill(m.headlineTemplate, {
    n: data.producesCustomers.newPer10Cards !== null ? data.producesCustomers.newPer10Cards.toFixed(1) : "—",
    m: data.producesCustomers.stayedPer10Cards !== null ? data.producesCustomers.stayedPer10Cards.toFixed(1) : "—",
    x: dec(data.producesCustomers.coffeesPerStayed) ?? "—",
    k: String(data.totals.noReturn),
  });

  return (
    <Screen
      tone="ink"
      fullWidth
      className="gap-8 pb-28 transition-[padding-left] duration-200 ease-[var(--ease-out-soft)] md:pb-10 md:pl-[calc(var(--admin-sidebar-width,16rem)+2rem)] md:pr-10"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <Link
            href="/inicio"
            prefetch={false}
            className="-m-2 p-2 text-chalk/45 transition-colors hover:text-chalk md:hidden"
            aria-label={t.home.eyebrow}
          >
            <HomeIcon className="size-6" />
          </Link>
          <div>
            <p className="eyebrow text-chalk/35">{ctx.shop.name}</p>
            <h1 className="display mt-1 text-[1.75rem] max-[560px]:text-[1.0625rem] md:text-[2rem]">
              {t.admin.metricsTitle}
            </h1>
          </div>
        </div>

        <nav aria-label={m.rangeLabel} className="glass-dark flex gap-1 rounded-full p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/metricas?range=${r}`}
              prefetch={false}
              className={cn(
                "rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors",
                r === range ? "bg-lime text-ink" : "text-chalk/55 hover:text-chalk",
              )}
            >
              {r === "7d" ? m.range7d : r === "30d" ? m.range30d : m.rangeAll}
            </Link>
          ))}
        </nav>
      </header>

      {/* 0 · aviso de integridad -condicional, bloquea la confianza en todo lo demás si aparece- */}
      <IntegrityBanner messages={integrityMessages} />

      {/* 1 · titular + 4 cifras */}
      <section className="flex flex-col gap-4">
        <p className="text-balance text-[1.0625rem] leading-relaxed text-chalk/80 max-[560px]:text-[0.9375rem]">
          {headline}
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(212px,1fr))] gap-3">
          <KpiCard
            label={m.kpiCoffeesPerStayed}
            value={dec(data.producesCustomers.coffeesPerStayed)}
            formula={formula(data.producesCustomers.coffeesPerStayed)}
            insufficientLabel={m.insufficientSample}
          />
          <KpiCard
            label={m.kpiGiftPerformance}
            value={pct(data.producesCustomers.giftPerformance)}
            formula={formula(data.producesCustomers.giftPerformance)}
            insufficientLabel={m.insufficientSample}
          />
          <KpiCard
            label={m.kpiInvitedShare}
            value={pct({
              value:
                data.totals.signups >= MIN_SAMPLE ? data.totals.invitedSignups / data.totals.signups : null,
            })}
            formula={`${data.totals.invitedSignups} ÷ ${data.totals.signups}`}
            insufficientLabel={m.insufficientSample}
          />
          <KpiCard
            label={m.kpiNoReturn}
            value={String(data.totals.noReturn)}
            formula={`count(sin_retorno)`}
            insufficientLabel={m.insufficientSample}
          />
        </div>
      </section>

      {/* 2 · ¿el programa produce clientes? */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-bold">{m.sectionProducesTitle}</h2>
          <p className="text-[0.75rem] text-chalk/32">{m.sectionProducesQuestion}</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(212px,1fr))] gap-3">
          <KpiCard
            label={m.kpiCoffeesPerStayed}
            value={dec(data.producesCustomers.coffeesPerStayed)}
            formula={formula(data.producesCustomers.coffeesPerStayed)}
            insufficientLabel={m.insufficientSample}
          />
          <KpiCard
            label={m.kpiGiftPerformance}
            value={pct(data.producesCustomers.giftPerformance)}
            formula={formula(data.producesCustomers.giftPerformance)}
            insufficientLabel={m.insufficientSample}
          />
          <KpiCard
            label={m.kpiNewPer10}
            value={data.producesCustomers.newPer10Cards !== null ? data.producesCustomers.newPer10Cards.toFixed(1) : null}
            formula={`${data.totals.invitedSignups} ÷ ${data.totals.cards} × 10`}
            insufficientLabel={m.insufficientSample}
          />
          <KpiCard
            label={m.kpiStayedPer10}
            value={data.producesCustomers.stayedPer10Cards !== null ? data.producesCustomers.stayedPer10Cards.toFixed(1) : null}
            formula={`${data.totals.stayed} ÷ ${data.totals.cards} × 10`}
            insufficientLabel={m.insufficientSample}
          />
        </div>
      </section>

      {/* 3 · dónde se cae la gente */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-bold">{m.sectionCascadeTitle}</h2>
          <p className="text-[0.75rem] text-chalk/32">{m.sectionCascadeQuestion}</p>
        </div>
        <div className="metrics-card p-[18px] max-[560px]:p-3">
          <Cascade
            steps={data.cascade.map((step) => ({
              label:
                step.key === "signups"
                  ? m.cascadeSignups
                  : step.key === "cards"
                    ? m.cascadeCards
                    : step.key === "sent"
                      ? m.cascadeSent
                      : step.key === "opened"
                        ? m.cascadeOpened
                        : step.key === "redeemed"
                          ? m.cascadeRedeemed
                          : m.cascadeStayed,
              value: step.value,
              drop: step.drop,
              alarm: step.key === "sent" && data.integrity.invitesExceedCards,
              reason:
                step.key === "signups"
                  ? m.cascadeSignupsReason
                  : step.key === "cards"
                    ? m.cascadeCardsReason
                    : step.key === "sent"
                      ? m.cascadeSentReason
                      : step.key === "opened"
                        ? m.cascadeOpenedReason
                        : step.key === "redeemed"
                          ? m.cascadeRedeemedReason
                          : fill(m.cascadeStayedReason, { w: data.totals.inWindow, d: data.totals.noReturn }),
            }))}
          />
        </div>
      </section>

      {/* 4 · las invitaciones, una a una + 3 puertas + velocidad */}
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-[0.9375rem] font-bold">{m.sectionWaffleTitle}</h2>
          <p className="text-[0.75rem] text-chalk/32">{m.sectionWaffleQuestion}</p>
        </div>

        <div className="metrics-card p-[18px] max-[560px]:p-3">
          <InviteWaffle
            groups={data.waffle.groups}
            total={data.waffle.total}
            coffeesConsumed={data.waffle.coffeesConsumed}
            labels={waffleLabels}
            coffeesConsumedLabel={m.waffleCoffeesConsumed}
          />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(268px,1fr))] gap-3">
          <BulletGate
            gate={data.gates.p1}
            label={t.admin.gate1}
            passesLabel={t.admin.passes}
            belowLabel={t.admin.below}
            insufficientLabel={t.admin.insufficient}
            targetLabel={t.admin.target}
            insufficientBodyLabel={t.admin.insufficientBody}
          />
          <BulletGate
            gate={data.gates.p2}
            label={t.admin.gate2}
            passesLabel={t.admin.passes}
            belowLabel={t.admin.below}
            insufficientLabel={t.admin.insufficient}
            targetLabel={t.admin.target}
            insufficientBodyLabel={t.admin.insufficientBody}
          />
          <BulletGate
            gate={data.gates.p3}
            label={t.admin.gate3}
            passesLabel={t.admin.passes}
            belowLabel={t.admin.below}
            insufficientLabel={t.admin.insufficient}
            targetLabel={t.admin.target}
            insufficientBodyLabel={t.admin.insufficientBody}
          />
        </div>

        <div>
          <h3 className="text-[0.875rem] font-semibold text-chalk/70">{m.sectionVelocityTitle}</h3>
          <div className="metrics-card mt-3 p-[18px] max-[560px]:p-3">
            <CycleVelocity
              steps={[
                { label: m.velocityInviteToOpen, days: data.velocity.steps[0].days },
                { label: m.velocityOpenToRedeem, days: data.velocity.steps[1].days },
                {
                  label: m.velocityRedeemToSecond,
                  days: data.velocity.steps[2].days,
                  alarm: data.velocity.alarmThirdStep,
                },
              ]}
              windowDays={data.velocity.windowDays}
              windowLabel={m.velocityWindow}
              formatDays={(days) => fill(m.velocityDays, { n: days })}
            />
          </div>
        </div>
      </section>

      {/* 5 · ¿el invitado vale más? + cohortes */}
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-[0.9375rem] font-bold">{m.sectionComparisonTitle}</h2>
          <p className="text-[0.75rem] text-chalk/32">{m.sectionComparisonQuestion}</p>
        </div>
        <ComparisonRows
          invitedLabel={m.comparisonInvited}
          directLabel={m.comparisonDirect}
          insufficientLabel={m.insufficientSample}
          rows={[
            {
              label: m.comparisonStampingAt30,
              invited: data.comparison[0].invited,
              direct: data.comparison[0].direct,
              multiplier: data.comparison[0].multiplier,
              format: (v) => `${Math.round(v)}%`,
            },
            {
              label: m.comparisonStampsFirstMonth,
              invited: data.comparison[1].invited,
              direct: data.comparison[1].direct,
              multiplier: data.comparison[1].multiplier,
              format: (v) => v.toFixed(1),
            },
            {
              label: m.comparisonDaysToSecondVisit,
              invited: data.comparison[2].invited,
              direct: data.comparison[2].direct,
              multiplier: data.comparison[2].multiplier,
              format: (v) => v.toFixed(1),
            },
            {
              label: m.comparisonCompletesFirstCard,
              invited: data.comparison[3].invited,
              direct: data.comparison[3].direct,
              multiplier: data.comparison[3].multiplier,
              format: (v) => `${Math.round(v)}%`,
            },
          ]}
        />

        <div>
          <h3 className="text-[0.875rem] font-semibold text-chalk/70">{m.sectionCohortsTitle}</h3>
          <div className="metrics-card mt-3 p-[18px] max-[560px]:p-3">
            <CohortGrid
              cohorts={data.cohorts}
              directLabel={m.cohortsDirect}
              invitedLabel={m.cohortsInvited}
              weekLabel={(n) => fill(m.cohortsWeek, { n })}
              futureLabel={m.cohortsFuture}
            />
          </div>
        </div>
      </section>

      {/* 6 · ¿se sostiene el motor solo? */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[0.9375rem] font-bold">{m.sectionEngineTitle}</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(212px,1fr))] gap-3">
          <KpiCard
            label={m.kpiCardsWithInvite}
            value={pct(data.engine.cardsWithInvite)}
            formula={formula(data.engine.cardsWithInvite)}
            insufficientLabel={m.insufficientSample}
            alarm={data.engine.cardsWithInvite.value !== null && data.engine.cardsWithInvite.value < 0.7}
          />
          <KpiCard
            label={m.kpiPadrinosRepeat}
            value={pct(data.engine.padrinosRepeat)}
            formula={formula(data.engine.padrinosRepeat)}
            insufficientLabel={m.insufficientSample}
            alarm={data.engine.padrinosRepeat.value !== null && data.engine.padrinosRepeat.value < 0.25}
          />
          <KpiCard
            label={m.kpiInvitesPerPadrino}
            value={data.engine.invitesPerPadrino !== null ? data.engine.invitesPerPadrino.toFixed(1) : null}
            formula="mediana"
            insufficientLabel={m.insufficientSample}
          />
          <KpiCard
            label={m.kpiDepthTwoPlus}
            value={pct(data.engine.depthTwoPlusShare)}
            formula={formula(data.engine.depthTwoPlusShare)}
            insufficientLabel={m.insufficientSample}
          />
        </div>
      </section>

      {/* 7 · salud de la base */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[0.9375rem] font-bold">{m.sectionHealthTitle}</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(212px,1fr))] gap-3">
          <KpiCard label={m.kpiActive} value={String(data.baseHealth.active)} formula="scans.kind=stamp ≤30d" insufficientLabel={m.insufficientSample} />
          <KpiCard label={m.kpiDormant} value={String(data.baseHealth.dormant)} formula="15-45d" insufficientLabel={m.insufficientSample} />
          <KpiCard label={m.kpiOff} value={String(data.baseHealth.off)} formula=">45d" insufficientLabel={m.insufficientSample} />
          <KpiCard
            label={m.kpiReactivation}
            value={pct(data.baseHealth.reactivationRate)}
            formula={formula(data.baseHealth.reactivationRate)}
            insufficientLabel={m.insufficientSample}
          />
        </div>
      </section>

      {/* 8 · padrinos */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[0.9375rem] font-bold">{m.sectionPadrinosTitle}</h2>
        <PadrinoTable
          rows={data.padrinos}
          labels={{
            customer: m.padrinosCustomer,
            invited: m.padrinosInvited,
            opened: m.padrinosOpened,
            redeemed: m.padrinosRedeemed,
            stayed: m.padrinosStayed,
            status: m.padrinosStatus,
          }}
          statusLabels={{ active: m.statusActive, dormant: m.statusDormant, off: m.statusOff }}
          emptyLabel={m.padrinosEmpty}
        />
      </section>

      {/* 9 · a quién darle el siguiente café */}
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-[0.9375rem] font-bold">{m.sectionTodoTitle}</h2>
          <p className="text-[0.75rem] text-chalk/32">{m.todoWhatsappDisabled}</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(268px,1fr))] gap-5">
          <TodoSection
            title={m.todoOneStampAway}
            rows={data.todo.oneStampAway.map((row) => ({ id: row.id, primary: row.name }))}
            emptyLabel={m.todoEmpty}
            whatsappDisabledLabel={m.todoWhatsappDisabled}
          />
          <TodoSection
            title={m.todoDormant}
            rows={data.todo.dormantToReactivate.map((row) => ({
              id: row.id,
              primary: row.name,
              secondary: fill(m.todoDaysAgo, { n: row.lastSeenDays }),
            }))}
            emptyLabel={m.todoEmpty}
            whatsappDisabledLabel={m.todoWhatsappDisabled}
          />
          <TodoSection
            title={m.todoReadyUnused}
            rows={data.todo.readyToInviteUnused.map((row) => ({ id: row.id, primary: row.name }))}
            emptyLabel={m.todoEmpty}
            whatsappDisabledLabel={m.todoWhatsappDisabled}
          />
          <TodoSection
            title={m.todoExpiring}
            rows={data.todo.expiringSoon.map((row) => ({
              id: row.id,
              primary: row.padrinoName,
              secondary: fill(m.todoHoursLeft, { n: row.hoursLeft }),
            }))}
            emptyLabel={m.todoEmpty}
            whatsappDisabledLabel={m.todoWhatsappDisabled}
          />
          <TodoSection
            title={m.todoReferrersReview}
            rows={data.todo.referrersToReview.map((row) => ({ id: row.id, primary: row.name }))}
            emptyLabel={m.todoEmpty}
            whatsappDisabledLabel={m.todoWhatsappDisabled}
          />
        </div>
      </section>

      {/* 9(bis) · señales de barra */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[0.9375rem] font-bold">{m.sectionBarTitle}</h2>
        <div className="metrics-card p-[18px] max-[560px]:p-3">
          <BarHistogram hourHistogram={data.barSignals.hourHistogram} label={m.barHistogram} />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
          <Signal
            label={m.barScanTime}
            value={data.barSignals.avgScanMs === null ? "—" : `${(data.barSignals.avgScanMs / 1000).toFixed(1)} s`}
            alarm={data.barSignals.avgScanMs !== null && data.barSignals.avgScanMs > 3000}
          />
          <Signal
            label={m.barManualRate}
            value={data.barSignals.manualRate === null ? "—" : `${Math.round(data.barSignals.manualRate * 100)}%`}
            alarm={data.barSignals.manualRate !== null && data.barSignals.manualRate > 0.15}
          />
          <Signal label={m.barDepth} value={String(data.barSignals.maxDepth)} />
          <Signal label={m.barStreak} value={String(data.barSignals.redeemStreakDays)} />
          <Signal label={m.barTotalScans} value={String(data.barSignals.totalScans)} />
          <Signal label={m.barExpired} value={String(data.barSignals.expiredInvites)} />
        </div>
      </section>

      <Link
        href="/privacidad?from=admin"
        className="btn mt-auto items-center gap-2 bg-ink-2 px-6 py-4 text-[1rem] text-chalk ring-1 ring-inset ring-chalk/15 lg:self-start"
      >
        <ShieldIcon className="size-5" />
        {t.admin.linksPrivacy}
      </Link>

      <BottomNav t={t.admin} active="metricas" />
    </Screen>
  );
}

function Signal({ label, value, alarm }: { label: string; value: string; alarm?: boolean }) {
  return (
    <div className={cn("metrics-card p-[18px]", alarm && "ring-1 ring-coral/40")}>
      <dt className="text-[0.8125rem] leading-snug text-chalk/45">{label}</dt>
      <dd className={cn("numeral mt-2 text-[1.375rem] font-semibold", alarm && "text-coral")}>{value}</dd>
    </div>
  );
}
