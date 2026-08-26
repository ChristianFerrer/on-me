/**
 * "Qué hacer hoy": el botón de WhatsApp existe en el marcado -para que el
 * día que haya consentimiento comercial registrado baste con quitar el
 * `disabled`, no rehacer la fila- pero se muestra siempre deshabilitado
 * hoy: OnMe no guarda todavía ningún consentimiento de contacto comercial,
 * solo el de tratamiento de datos para la tarjeta -son bases legales
 * distintas-, así que no se envía nada.
 */
export function TodoSection({
  title,
  rows,
  emptyLabel,
  whatsappDisabledLabel,
}: {
  title: string;
  rows: { id: string; primary: string; secondary?: string }[];
  emptyLabel: string;
  whatsappDisabledLabel: string;
}) {
  return (
    <div>
      <p className="eyebrow text-chalk/40">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-[0.8125rem] text-chalk/35">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/4 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[0.875rem] font-medium">{row.primary}</p>
                {row.secondary ? <p className="text-[0.75rem] text-chalk/40">{row.secondary}</p> : null}
              </div>
              <button
                type="button"
                disabled
                title={whatsappDisabledLabel}
                aria-label={whatsappDisabledLabel}
                className="btn shrink-0 cursor-not-allowed bg-white/6 px-3 py-2 text-[0.75rem] text-chalk/30"
              >
                WhatsApp
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
