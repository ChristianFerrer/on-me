import {
  FlowArrow,
  PhoneFrame,
  WfDashboard,
  WfForm,
  WfInvite,
  WfList,
  WfMap,
  WfQr,
  WfScanner,
  WfStampCard,
  WfVerdict,
  WireframeStrip,
} from "@/components/guide/Wireframes";
import { Screen, Slab } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { getI18n } from "@/lib/i18n/server";

/**
 * Explicación del flujo completo para quien recién se une al equipo: los
 * tres papeles -cliente, mostrador, panel- con su propio recorrido, cada
 * paso con una maqueta esquemática de la pantalla real y el texto que
 * explica qué pasa ahí. Enlazada desde el tile de "cómo funciona" en
 * /inicio -pública, como el resto del portal del equipo, porque no enseña
 * ningún dato, solo el mecanismo.
 */
export default async function ComoFuncionaPage() {
  const { t } = await getI18n();
  const m = t.guide;

  return (
    <Screen tone="ink" className="gap-7">
      <TopBar back="/inicio" backLabel={t.home.eyebrow} />

      <div>
        <p className="eyebrow text-chalk/40">{m.eyebrow}</p>
        <h1 className="display mt-1.5 text-[2rem]">{m.title}</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-chalk/60">{m.intro}</p>
      </div>

      <nav aria-label={m.title} className="glass-dark flex gap-1 rounded-full p-1">
        {[
          { href: "#cliente", label: m.navCliente },
          { href: "#barista", label: m.navBarista },
          { href: "#dueno", label: m.navDueno },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex-1 rounded-full px-3 py-2 text-center text-[0.8125rem] font-medium text-chalk/65 transition-colors hover:bg-white/6 hover:text-chalk"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <RoleSection
        id="cliente"
        title={m.clienteTitle}
        intro={m.clienteIntro}
        note={m.clienteNote}
        steps={[
          { label: m.clienteStep1Label, title: m.clienteStep1Title, body: m.clienteStep1Body },
          { label: m.clienteStep2Label, title: m.clienteStep2Title, body: m.clienteStep2Body },
          { label: m.clienteStep3Label, title: m.clienteStep3Title, body: m.clienteStep3Body },
          { label: m.clienteStep4Label, title: m.clienteStep4Title, body: m.clienteStep4Body },
          { label: m.clienteStep5Label, title: m.clienteStep5Title, body: m.clienteStep5Body },
        ]}
        strip={
          <>
            <PhoneFrame tone="aurora" caption={m.clienteStep1Label}>
              <WfQr />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="aurora" caption={m.clienteStep2Label}>
              <WfForm />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="aurora" caption={m.clienteStep3Label}>
              <WfStampCard filled={4} total={8} />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="aurora" caption={m.clienteStep4Label}>
              <WfStampCard filled={8} total={8} />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="aurora" caption={m.clienteStep5Label}>
              <WfInvite />
            </PhoneFrame>
          </>
        }
      />

      <RoleSection
        id="barista"
        title={m.baristaTitle}
        intro={m.baristaIntro}
        steps={[
          { label: m.baristaStep1Label, title: m.baristaStep1Title, body: m.baristaStep1Body },
          { label: m.baristaStep2Label, title: m.baristaStep2Title, body: m.baristaStep2Body },
          { label: m.baristaStep3Label, title: m.baristaStep3Title, body: m.baristaStep3Body },
          { label: m.baristaStep4Label, title: m.baristaStep4Title, body: m.baristaStep4Body },
        ]}
        strip={
          <>
            <PhoneFrame tone="ink" caption={m.baristaStep1Label}>
              <WfForm />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="ink" caption={m.baristaStep2Label}>
              <WfScanner />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="ink" caption={m.baristaStep3Label}>
              <WfVerdict tone="lime" />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="ink" caption={m.baristaStep4Label}>
              <WfList rows={3} />
            </PhoneFrame>
          </>
        }
      />

      <RoleSection
        id="dueno"
        title={m.duenoTitle}
        intro={m.duenoIntro}
        steps={[
          { label: m.duenoStep1Label, title: m.duenoStep1Title, body: m.duenoStep1Body },
          { label: m.duenoStep2Label, title: m.duenoStep2Title, body: m.duenoStep2Body },
          { label: m.duenoStep3Label, title: m.duenoStep3Title, body: m.duenoStep3Body },
          { label: m.duenoStep4Label, title: m.duenoStep4Title, body: m.duenoStep4Body },
        ]}
        strip={
          <>
            <PhoneFrame tone="ink" caption={m.duenoStep1Label}>
              <WfForm />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="ink" caption={m.duenoStep2Label}>
              <WfMap />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="ink" caption={m.duenoStep3Label}>
              <WfDashboard />
            </PhoneFrame>
            <FlowArrow />
            <PhoneFrame tone="ink" caption={m.duenoStep4Label}>
              <WfList rows={3} />
            </PhoneFrame>
          </>
        }
      />

      <div className="flex-1" />
    </Screen>
  );
}

/** Un papel -cliente, mostrador o panel-: su propia maqueta en miniatura seguida del recorrido numerado que la explica. */
function RoleSection({
  id,
  title,
  intro,
  strip,
  steps,
  note,
}: {
  id: string;
  title: string;
  intro: string;
  strip: React.ReactNode;
  steps: { label: string; title: string; body: string }[];
  note?: string;
}) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4">
      <div>
        <h2 className="text-[1.25rem] font-bold">{title}</h2>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-chalk/55">{intro}</p>
      </div>

      <WireframeStrip>{strip}</WireframeStrip>

      <Slab className="flex flex-col gap-5 p-6">
        {steps.map((step, i) => (
          // Por índice, no por `step.label`: en inglés el paso 1 ("invite
          // received") y el paso 5 ("invite others") comparten la misma
          // palabra corta -"invite"-, así que la etiqueta no es una clave
          // única de fiar. La lista es estática -nunca se reordena ni se
          // filtra-, así que el índice es una clave segura aquí.
          <div key={i} className="flex items-start gap-4">
            <span className="numeral flex size-8 shrink-0 items-center justify-center rounded-full bg-lime text-[0.8125rem] font-bold text-ink">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{step.title}</p>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-chalk/55">{step.body}</p>
            </div>
          </div>
        ))}
      </Slab>

      {note ? (
        <p className="rounded-xl bg-white/6 px-4 py-3 text-[0.8125rem] leading-relaxed text-chalk/55">{note}</p>
      ) : null}
    </section>
  );
}
