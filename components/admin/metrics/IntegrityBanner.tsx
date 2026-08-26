/**
 * Banda de integridad: no es decorativa, bloquea la confianza en el resto de
 * la página hasta que se corrija -por eso va arriba del todo, antes que
 * cualquier cifra-.
 */
export function IntegrityBanner({ messages }: { messages: string[] }) {
  if (!messages.length) return null;

  return (
    <div role="alert" className="rounded-2xl bg-coral px-5 py-4">
      <ul className="flex flex-col gap-1 text-[0.9375rem] font-semibold text-ink">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
