# Auditoría UX/UI — OnMe

**Alcance:** toda la app (Next.js 16 + TypeScript + Tailwind v4, PWA, mobile-first), auditada por rol.
**Método:** lectura completa del código real (rutas, componentes, `globals.css`, i18n, reglas de negocio en `lib/`) — sin inventar pantallas ni componentes que no existan. Cuatro auditorías paralelas, una por rol, más un barrido específico de código muerto.
**No se ha tocado ningún archivo de código** en esta fase. Este documento es el entregable de Fase 0–3; la implementación empieza solo cuando se apruebe.

## Resumen ejecutivo

| Severidad | Nº hallazgos |
|---|---|
| 🔴 Crítica | 4 |
| 🟠 Alta | 19 |
| 🟡 Media | 33 |
| ⚪ Baja | 27 |
| **Total** | **83** |

Los 4 roles reales de la app son: **Cliente** (tarjeta de sellos, invitar), **Barista/empleado** (escanear, sellar, canjear en barra), **Admin/dueño** (panel: constelación, métricas, dispositivos, visitas) y **Público/portal** (landing, portal `/inicio`, ayuda, privacidad). A esto se suma un barrido de **código muerto** transversal.

Las 4 críticas, resumidas:
1. **CLI-01** — si un cliente pierde la cookie de su tarjeta, la app lo deja sin ninguna salida.
2. **BAR-01** — el veredicto "no válido" del escáner (el que más se necesita leer rápido) tiene peor contraste que los demás.
3. **ADM-01** — el botón "simular actividad" borra el grafo real de clientes sin ningún aviso de confirmación.
4. **ADM-02** — la misma etiqueta ("invitaciones enviadas") muestra números distintos en dos pantallas del panel.

Todas son de esfuerzo **S** (pequeño). Ver el plan por lotes al final.

---

## Rol 1 — Cliente (usuario final de la cafetería)

### Inventario de pantallas

| Pantalla | Propósito | Acción primaria | Navega a |
|---|---|---|---|
| `app/j/[shop]/page.tsx` | Alta desde el QR de barra | Rellenar `JoinForm` | Éxito → `/c` |
| `app/j/[shop]/qr/page.tsx` | Cartel del QR (pantalla ambiente, no interactiva) | Escanear con la cámara | — |
| `app/i/[code]/page.tsx` | Landing del invitado (link de WhatsApp) | Aceptar café (`ClaimForm`) | Éxito → `/c`; error → callejón sin salida |
| `app/c/page.tsx` | Tarjeta del cliente (home) | Ver progreso / mostrar QR | `/c/invitar` si aplica |
| `app/c/invitar/page.tsx` | Generar y enviar invitación | Crear → enviar por WhatsApp | Vuelve a `/c` |

### Journey

Un cliente nuevo llega por QR físico (`/j/[shop]`) o enlace de WhatsApp (`/i/[code]`), rellena 3 campos y aterriza en `/c`, su tarjeta — ahí ve sellos, un QR que funciona offline, y (solo si ya completó una tarjeta) una invitación para regalar. Para invitar pasa a `/c/invitar`, genera un código y lo manda por `wa.me`. El punto más débil: durante todo el tiempo que tarda en completar su primera tarjeta, la app nunca le recuerda ni le explica el mecanismo de invitar — la pantalla que lo explicaría es inalcanzable por navegación (CLI-02). Si pierde la cookie, no hay ninguna forma de recuperar la tarjeta desde la app (CLI-01): la única salida es física, volver a la barra.

### Hallazgos

| ID | Pantalla/archivo | Categoría | Qué pasa | Impacto | Severidad | Solución propuesta | Esfuerzo |
|---|---|---|---|---|---|---|---|
| CLI-01 | `app/c/page.tsx` + `ui/TopBar.tsx` | flujo | Sin cookie/token válido, `/c` no ofrece ningún enlace de salida (el logo del TopBar no es un `Link`). | Cliente que pierde su sesión queda atrapado sin saber qué hacer. | 🔴 Crítica | CTA explícito ("pide tu QR en la barra") o enlace a `/j/[shop]` / al home. | S |
| CLI-02 | `app/c/page.tsx` + `client/InvitePanel.tsx` | flujo | Sin `canCreateInvite` ni invitación activa, la sección de invitar no se renderiza (`: null`). | El mecanismo de invitar es invisible durante toda la primera tarjeta; nadie lo descubre navegando. | 🟠 Alta | Mostrar siempre un bloque discreto ("invita cuando completes tu tarjeta") con enlace a `/c/invitar`. | S |
| CLI-03 | `app/i/[code]/page.tsx` (`Notice`) | flujo | Los 4 estados de error (caducada/usada/inválida/rate-limit) no llevan botón ni enlace. | Para mucha gente es la única pantalla de OnMe que verán; sin siguiente paso. | 🟠 Alta | CTA acorde al copy ("escríbele a quien te invitó" o alta directa). | S |
| CLI-04 | `app/c/page.tsx` + `InvitePanel.tsx` | redundancia | Solo se muestra `activeInvites[0]`; el negocio permite varias invitaciones activas a la vez. | Invitaciones adicionales "desaparecen" de la vista del cliente. | 🟠 Alta | Listar todas las `activeInvites` o mostrar un contador con acceso a todas. | M |
| CLI-05 | `app/layout.tsx` | a11y | `viewport.maximumScale = 1` desactiva el pinch-zoom en toda la PWA. | Bloquea ampliar contenido a usuarios con baja visión (WCAG 1.4.4). | 🟠 Alta | Quitar `maximumScale`/`userScalable` o subirlo a ~5. | S |
| CLI-06 | `app/c/page.tsx`, `InvitePanel.tsx`, `.slab` | a11y | `text-chalk/40` sobre `.slab` ≈ 2.5:1 de contraste, por debajo de AA. | Etiquetas (nombre del local, "invitación enviada") casi ilegibles con baja visión o sol. | 🟠 Alta | Subir el piso de opacidad de "eyebrow" sobre superficies oscuras a ~/60-65. | S |
| CLI-07 | `app/c/page.tsx`, `app/i/[code]/page.tsx` | a11y | Texto de cuerpo (`chalk/55-60`) sobre `.slab` ronda 3.1-3.7:1. | Copys de error/contexto en el límite de legibilidad. | 🟡 Media | Subir opacidad mínima a ~/70 para texto de cuerpo sobre `.slab`. | S |
| CLI-08 | `client/JoinForm.tsx` (`Consent`) | a11y | El checkbox real es `sr-only`; el `span` visual no replica `:focus-visible`. | Usuarios de teclado no ven foco al llegar al consentimiento. | 🟠 Alta | `peer-focus-visible:` (outline/ring) sobre el `span` visual. | S |
| CLI-09 | `app/c/page.tsx` | a11y | El estado por defecto de la tarjeta no usa `h1`/`h2`; el estado de premio sí. | Jerarquía de encabezados inconsistente en la pantalla más visitada. | 🟡 Media | Convertir el contador de sellos/nombre del local en encabezado semántico también en el estado por defecto. | S |
| CLI-10 | `app/j/[shop]/qr/page.tsx` | responsive | Enlace de inicio (`size-6`=24px) sin padding extra → área táctil real 24×24px. | Fácil fallar el toque en pantalla táctil. | 🟡 Media | Añadir `p-2` al `Link` sin cambiar el tamaño visual del icono. | S |
| CLI-11 | `app/c/page.tsx` + `ui/Button.tsx` | responsive | `Button size="sm"` (~38-40px alto) para enviar invitación por WhatsApp. | Objetivo táctil bajo el mínimo recomendado para una acción real. | ⚪ Baja | Subir a `size="md"` en ese caso. | S |
| CLI-12 | `ui/Screen.tsx` + `app/j/[shop]/qr/page.tsx` | responsive | `safe-area-inset` solo se aplica en vertical, no en horizontal. | En landscape con notch lateral, contenido de los bordes puede quedar tapado. | 🟡 Media | Añadir `padding-inline: max(1.25rem, env(safe-area-inset-left/right))`. | S |
| CLI-13 | `app/c/page.tsx` | responsive | Contador de sellos en `text-[3.25rem]` fijo, sin `clamp()`, a diferencia de otros titulares. | Riesgo menor de desproporción en pantallas muy chicas/grandes. | ⚪ Baja | Sustituir por `clamp()` en línea con el resto de titulares. | S |
| CLI-14 | `app/manifest.ts` | responsive | `orientation: "portrait"` puede forzar vertical en la PWA instalada Android. | Contradice cualquier uso en landscape una vez instalada. | ⚪ Baja | Quitar la restricción o confirmar que es deliberada. | S |
| CLI-15 | `app/globals.css` + varios | estética | No hay escala tipográfica en `@theme`; cada componente repite `text-[…]` arbitrarios. | Ajustar un tamaño exige tocar archivo por archivo. | 🟡 Media | Definir 4-5 pasos (`--text-body`, `--text-caption`…) y migrar los repetidos. | M |
| CLI-16 | `app/j/[shop]/qr/page.tsx` | estética | Radio del cartel (`rounded-[2.5rem]`=40px) no coincide con `--radius-card` (28px). | Inconsistencia visual sutil frente al resto de superficies tipo tarjeta. | ⚪ Baja | Usar `rounded-[var(--radius-card)]`. | S |
| CLI-17 | `ui/Button.tsx` | estética | Tono `ghost` usa `rgba(12,18,16,…)` a mano en vez del token `--color-ink`. | Deriva de color silenciosa si el token cambia. | ⚪ Baja | `border-ink/16` + `hover:bg-ink/5` con el token real. | S |
| CLI-18 | `ui/QrCode.tsx` | estética | Color del QR (`#0e1211`) hardcodeado (la librería no lee CSS vars). | Riesgo bajo de desincronía si el token cambia. | ⚪ Baja | Extraer a una constante compartida importada aquí y donde haga falta. | S |
| CLI-19 | `client/ClaimForm.tsx` / `JoinForm.tsx` | redundancia | Ambos formularios casi idénticos (mismos 3 campos, mismo patrón de error/busy). | Cambios de UX hay que replicarlos a mano en dos sitios; ya divergieron una vez. | 🟡 Media | Extraer un `CustomerForm` compartido parametrizado por endpoint + slot de estado especial. | M |
| CLI-20 | `app/c/page.tsx` + `app/c/invitar/page.tsx` | redundancia | La regla "invitación a mostrar / cupo lleno" se recalcula por separado en dos páginas. | Riesgo de aplicar un cambio de regla en una pantalla y olvidarlo en la otra. | ⚪ Baja | Mover el cálculo a `CardData` en `lib/card.ts`. | S |
| CLI-21 | `app/c/invitar/page.tsx` + `lib/attribution.ts` | flujo | Las reglas mostradas no mencionan la ventana mínima de 24h ni el plazo máximo de retorno. | Si el invitado vuelve fuera de plazo, el padrino no entiende por qué no ganó sellos. | 🟡 Media | Añadir/matizar una regla con el plazo real. | S |
| CLI-22 | `client/JoinForm.tsx` / `ClaimForm.tsx` | flujo | El teléfono no indica si es obligatorio; el error de formato solo aparece tras el envío. | El usuario descubre el requisito solo después de esperar respuesta del servidor. | ⚪ Baja | Validación ligera en cliente antes del submit, o marcar el campo. | S |
| CLI-23 | `app/j/[shop]/page.tsx` / `qr/page.tsx` (sin `not-found.tsx`) | flujo | Slug de local inexistente cae en el 404 genérico de Next, sin marca. | Rompe la continuidad visual en el primer contacto. | ⚪ Baja | Añadir `app/not-found.tsx` con el mismo lenguaje visual. | S |
| CLI-24 | `client/OfflineBadge.tsx` | flujo | Depende solo de `navigator.onLine`, que no detecta wifi cautivo/cobertura débil real. | El badge dice "online" mientras las acciones de red fallan igualmente. | ⚪ Baja | Complementar con un ping ligero a un endpoint propio. | M |

**Ya está bien y no se toca:** no hay truncado de copy real en español en ninguna pantalla de cliente; `dvh` + `safe-area-inset` en `Screen` bien resuelto; el QR embebido como SVG inline para funcionar offline es una decisión acertada y documentada.

---

## Rol 2 — Barista/empleado (mostrador)

### Inventario de pantallas

| Pantalla/estado | Propósito | Acción primaria | Navega a |
|---|---|---|---|
| `app/s/page.tsx` — no enrolado | Bloquear dispositivo no dado de alta | Ninguna | Volver a `/inicio` |
| `app/s/page.tsx` + `Scanner.tsx` — idle/scanning | Escanear QR del cliente | Apuntar cámara | Verdict o PinPad overlay |
| `Scanner.tsx` — no_camera/offline | Informar bloqueo | Ninguna (sin retry) | `/s/buscar` |
| `app/s/buscar/page.tsx` | Buscar cliente por móvil completo | Escribir teléfono | `/s/cliente/[id]` |
| `app/s/cliente/[id]/page.tsx` | Ver tarjeta y sellar a mano | "Sellar a mano" | Verdict/PinPad overlay |

### Journey

Con un cliente delante, escanear→veredicto→siguiente cliente es un ciclo de **cero taps** para el caso normal (sello): el decode dispara el POST solo, el veredicto se pinta a pantalla completa y se autocierra a los 2000ms — esto está muy bien resuelto. Cuando el escaneo falla, un tap lleva a `/s/buscar` → resultado → ficha del cliente, que reutiliza la misma máquina de estados (incluido PIN). Los puntos débiles están en los bordes: la ficha del cliente no tiene atajo directo de vuelta a la cámara (BAR-07), un fallo de red o de sesión de dispositivo se disfrazan del mismo mensaje que un QR roto (BAR-02, BAR-03), y la pantalla de bloqueo por cámara no ofrece retry (BAR-05) pese a existir el string ya traducido sin usar.

### Hallazgos

| ID | Pantalla/archivo | Categoría | Qué pasa | Impacto | Severidad | Solución propuesta | Esfuerzo |
|---|---|---|---|---|---|---|---|
| BAR-01 | `barista/Verdict.tsx` + `.verdict-coral` | a11y | Veredicto "no válido": texto casi blanco sobre coral, contraste ~2.5:1. | Es el estado que más hay que leer rápido "a dos metros" y es el menos legible de los cinco. | 🔴 Crítica | Usar texto oscuro (`--color-ink`) sobre `.verdict-coral`, igual que en los demás veredictos. | S |
| BAR-02 | `barista/useScanFlow.ts` (`post`) | flujo | Cualquier no-OK que no sea 403 (p. ej. 401 por sesión revocada) se pinta como "código no reconocido". | Si se revoca el dispositivo a media jornada, cada escaneo parece un QR roto, sin pista real. | 🟠 Alta | Distinguir el 401 de sesión con mensaje propio ("dispositivo no autorizado"). | M |
| BAR-03 | `barista/useScanFlow.ts` (catch) | flujo | Un fallo de red puntual se muestra igual que un QR inválido. | El barista puede pensar que la tarjeta del cliente está mal por un corte de wifi. | 🟠 Alta | Mensaje de error de red específico ("no se ha podido conectar, prueba otra vez"). | S |
| BAR-04 | `barista/PinPad.tsx` | responsive | Sin `max-w`; en tablet/desktop las teclas se estiran enormes, en landscape bajo pueden recortarse. | Teclado de PIN desproporcionado/recortado justo donde se exige precisión con el pulgar. | 🟠 Alta | Contenedor con `max-w` (~26-28rem) centrado; limitar altura de fila o permitir scroll en viewports bajos. | M |
| BAR-05 | `barista/useQrScanner.ts` + `Scanner.tsx` | flujo | Si falla `getUserMedia`, `status` queda bloqueado para siempre (el efecto corre una sola vez); existe el string "reintentar" sin usar en ningún sitio. | Sin botón para reintentar tras conceder el permiso después del primer rechazo. | 🟠 Alta | Botón "reintentar" visible en el estado bloqueado. | S |
| BAR-06 | `barista/Scanner.tsx` | flujo | El texto del pie no cambia mientras la petición está en curso; sigue diciendo "apunta al código". | Entre decode y veredicto no hay indicio de "procesando", puede generar dudas/movimiento del móvil. | 🟡 Media | Texto de pie "comprobando…" ligado a `phase.step === "sending"`. | S |
| BAR-07 | `app/s/cliente/[id]/page.tsx` | flujo | El único enlace vuelve a `/s/buscar`, no a `/s` (cámara); dos "volver" en cascada para llegar a escanear. | Tap extra en el ciclo cliente-tras-cliente, el camino más usado. | 🟡 Media | Icono de inicio/escáner junto al "volver" en la ficha. | S |
| BAR-08 | `app/globals.css` (`:focus-visible`) | a11y | Anillo de foco `outline: 2px solid ink` (casi negro) sobre pantallas oscuras del barista. | Foco prácticamente invisible en Scanner/PinPad/Verdict oscuros. | 🟠 Alta | Color de foco que se adapte al tono de fondo, o doble contorno blanco+negro. | M |
| BAR-09 | `barista/PinPad.tsx` | a11y | Tecla de borrar usa `aria-label="←"` (el símbolo), no una palabra. | Lector de pantalla anuncia el carácter, no "borrar". | 🟡 Media | Clave i18n `backspace` = "borrar" como `aria-label`. | S |
| BAR-10 | `lib/i18n/dictionaries.ts` | redundancia | 4 claves del bloque `barista` no se referencian en ningún componente; `idleHint` describe una búsqueda por 4 dígitos que ya no existe. | Sin impacto visible hoy; deuda de contenido/riesgo de instrucción incorrecta si se reactiva. | ⚪ Baja | Eliminar claves muertas o corregir `idleHint` para reflejar la búsqueda por móvil completo. | S |
| BAR-11 | `barista/Verdict.tsx` | flujo | El botón de confirmación en canjes siempre dice "confirmar", ignorando `rewardConfirm`/`inviteConfirm` ya escritos. | Bajo presión no queda claro si hay que entregar el café antes o después de confirmar. | 🟡 Media | Usar los strings específicos ya existentes en el botón. | S |
| BAR-12 | `barista/Scanner.tsx` | responsive | Nombre del local sin `truncate`/`max-w` en la píldora de cabecera. | Con nombre largo en 320-375px, envuelve y descompensa la cabecera. | ⚪ Baja | `truncate` + `max-w` al nombre, o `flex-1 min-w-0` al contenedor. | S |
| BAR-13 | `barista/PinPad.tsx` / `ManualSearch.tsx` | estética | `rounded-2xl` (Tailwind por defecto) en vez de `--radius-card`/`--radius-field`. | Rompe coherencia del sistema de diseño. | ⚪ Baja | Sustituir por `rounded-[var(--radius-field)]`. | S |
| BAR-14 | `app/s/cliente/[id]/page.tsx` | estética | `bg-white` literal en vez de `--color-chalk`/`--color-paper`. | Casi imperceptible, pero fuera del sistema de tokens. | ⚪ Baja | Cambiar a `bg-chalk`/`bg-paper`. | S |
| BAR-15 | `barista/CustomerActions.tsx` | flujo | El botón siempre dice "sellar a mano" aunque la acción real pueda ser un canje de premio/invitación. | Sorpresa al aparecer una pantalla de PIN para "café gratis" sin anticiparlo en el botón. | 🟡 Media | Cambiar el texto del botón cuando haya premio/invitación pendiente. | M |
| BAR-16 | `barista/Scanner.tsx` (`Target`) | responsive | La mirilla (`aspect-square max-w-[16rem]`) no tiene límite por alto; en landscape bajo puede recortarse. | Guía visual de encuadre del QR cortada en móvil apaisado en el mostrador. | 🟡 Media | Acotar también por alto disponible (`max-h-[40vh]` o similar). | S |
| BAR-17 | `barista/Verdict.tsx` | responsive | Botones "confirmar"/"cancelar" `w-full` sin límite de ancho en `fixed inset-0`. | En tablet/desktop se ven desproporcionadamente grandes. | ⚪ Baja | Envolver en `max-w-[26rem] mx-auto` manteniendo el fondo a pantalla completa. | S |
| BAR-18 | `ui/StampCard.tsx` vía ficha de cliente | responsive | Con `stamps_goal` alto en 320-375px, cada círculo mide ~17-23px; el número queda muy comprimido. | Detalle de progreso difícil de leer de un vistazo en móvil pequeño. | ⚪ Baja | Ocultar el número bajo cierto ancho, apoyarse solo en el patrón lleno/vacío. | S |
| BAR-19 | `barista/useScanFlow.ts` | flujo | `buzz()` (vibración) no se dispara en PIN incorrecto (403 `pin_wrong`), solo cambia el color del texto. | Con atención dividida (mirando al cliente), un PIN incorrecto puede pasar desapercibido. | 🟡 Media | Llamar a `buzz()` también en `{step:"pin", wrong:true}`. | S |

**Ya está bien y no se toca:** el ciclo principal escanear→veredicto→siguiente cliente en cero taps es sólido; `ManualSearch` con debounce de 400ms y búsqueda por móvil completo (no 4 dígitos) es una decisión correcta y bien resuelta.

---

## Rol 3 — Admin/dueño (panel)

### Inventario de pantallas

| Ruta | Propósito | Estado |
|---|---|---|
| `/admin` | Redirect a constelación (compat.) | stub, bien resuelto |
| `/admin/constelacion-sol` | **Home real**: grafo sol/estrellas, feed en vivo, insights | pantalla principal |
| `/admin/metricas` | Embudo, 3 puertas, tendencias, señales | vista de lectura |
| `/admin/dispositivos` | Alta/gestión de tablets de barra (PIN, revocar) | vista de gestión |
| `/admin/atribuciones` ("Visitas") | Buscar clientes/atribuciones | vista de lectura+búsqueda |
| `/admin/atribuciones/mapa`, `/admin/embudo`, `/admin/senales` | Redirects de compat. (ya fusionados) | stubs, bien resueltos |

De las "8 rutas" solo 4 son pantallas vivas; el resto son redirects deliberados y bien documentados.

### Journey

El dueño entra por `/inicio` → "panel" → aterriza en la constelación (el home cambió de la vieja vista de embudo, pero la copy del tile de `/inicio` no se actualizó — PUB-06/ADM-11). La navegación entre las 4 secciones reales es consistente (mismo `BottomNav` en las 4). Revocar el acceso de un dispositivo perdido es rápido (2 toques). El punto más débil: **buscar la cadena de un cliente concreto está partido entre dos pantallas sin puente** — el buscador por nombre/teléfono solo existe en Visitas (sin link a la constelación), y la constelación (que sí muestra la cadena) no tiene buscador (ADM-19).

### Hallazgos

| ID | Pantalla/archivo | Categoría | Qué pasa | Impacto | Severidad | Solución propuesta | Esfuerzo |
|---|---|---|---|---|---|---|---|
| ADM-01 | `admin/ConstelacionSolMap.tsx` (sim.) | flujo | El botón "simular actividad" vacía el grafo real (clientes reales incluidos) sin confirmación ni aviso persistente. | Un dueño que toque por curiosidad ve desaparecer a todos sus clientes reales sin explicación. | 🔴 Crítica | Confirmación explícita al activar + banner persistente "MODO DEMO". | S |
| ADM-02 | `lib/funnel.ts` vs `ConstelacionSolMap.tsx` (insights) | redundancia | "Invitaciones enviadas"/"abiertas" cuentan cosas distintas (histórico acumulado vs. estado actual) en dos pantallas del mismo panel. | El dueño ve números distintos con la misma etiqueta y cree que hay un bug. | 🔴 Crítica | Renombrar una de las dos métricas para reflejar su naturaleza real. | S |
| ADM-03 | `giftGraph/stateBadge.ts` vs `ConstelacionSolMap.tsx` (paleta) | estética | El mismo estado se pinta de color distinto en Visitas vs. constelación (facturable: lima vs. magenta; etc.), override deliberado pero no documentado fuera del propio archivo. | Rompe la asociación color→estado que la leyenda intenta enseñar. | 🟠 Alta | Documentar el override en la leyenda de Visitas o converger paletas donde no haya motivo de contraste real. | M |
| ADM-04 | `ConstelacionSolMap.tsx` (SVG interactivo) | a11y | El grafo es un único `svg` con gestos solo de puntero; ningún nodo es enfocable por teclado. | La pantalla principal del panel es inaccesible por teclado. | 🟠 Alta | Lista oculta navegable por teclado que seleccione el mismo nodo que un tap (reusar patrón de `FallbackList`). | L |
| ADM-05 | `BottomNav.tsx` + `ConstelacionSolMap.tsx` | responsive | El cambio a sidebar solo ocurre en `lg` (1024px); entre 768-1023px (tablet vertical, uso habitual de este rol) sigue la barra de móvil y los paneles laterales están `hidden`. | En tablet, el dueño recibe la experiencia de móvil pese a tener ancho de sobra. | 🟠 Alta | Bajar el breakpoint a `md` (768px) o crear un tratamiento intermedio. | M |
| ADM-06 | `ConstelacionSolMap.tsx` (estado vacío) | flujo | El único texto de estado vacío lleva `lg:hidden`; desaparece justo en el uso principal de este rol. | Un local nuevo sin clientes ve solo un sol solo, sin pista de qué hacer. | 🟠 Alta | Quitar `lg:hidden` o crear un estado vacío dedicado con CTA a "dispositivos". | S |
| ADM-07 | `ConstelacionMap.tsx` + `components/universe/*` | redundancia (dead-code) | Código muerto confirmado (ver sección de código muerto): ~2.500 líneas + 7 claves i18n × 4 idiomas sin ningún importador real. | Peso de mantenimiento sin beneficio para el usuario. | 🟠 Alta | Eliminar o mover fuera de `app/`/`components/`. | M |
| ADM-08 | i18n `guide.step5Body` vs `attrBillable` | flujo | La guía usa "atribución facturable"; el panel real siempre dice "nuevo verificado" para el mismo concepto. | El dueño tiene que hacer el puente mental entre dos vocabularios. | 🟡 Media | Unificar terminología o introducir el término alterno entre paréntesis la primera vez. | S |
| ADM-09 | `ConstelacionSolMap.tsx` (controles) | flujo | Solo 2 de 5 botones-icono llevan `title`; el de "ajustes" no abre un panel, solo alterna una opción concreta. | Difícil aprender qué hace cada icono sin tocarlos uno a uno. | 🟡 Media | Tooltips en los 5; icono más específico que el de "ajustes" genérico. | S |
| ADM-10 | `admin/atribuciones/page.tsx` | flujo | Título de página "Visitas" pero el estado vacío dice "no hay atribuciones" (resto de un renombrado). | Dos nombres distintos para el mismo concepto en la misma pantalla. | 🟡 Media | Cambiar el string del vacío a "no hay visitas". | S |
| ADM-11 | i18n `home.panel`/`panelBody` | flujo | La tile de `/inicio` describe el panel como "el embudo y las tres puertas", desactualizado desde que el home es la constelación. | Expectativa equivocada de lo que se va a ver al entrar. | 🟡 Media | Actualizar la copy a la constelación actual. | S |
| ADM-12 | `admin/FunnelBars.tsx` | flujo | Las 6 barras mezclan dos poblaciones (clientes propios vs. invitaciones de terceros) sin separación visual. | Puede leerse como abandono/pérdida cuando es solo cambio de unidad de medida. | 🟡 Media | Separador visual con rótulo entre el paso 2 y el 3. | S |
| ADM-13 | 3 páginas admin + `LoginForm.tsx` | flujo | Sesión expirada → redirect silencioso al login, sin mensaje de "tu sesión caducó". | Parece que la app expulsa sin motivo. | 🟡 Media | Query param + aviso breve sobre el `LoginForm`. | S |
| ADM-14 | Varios (`ConstelacionSolMap`, `GateCard`, `WaveChart`) | a11y | Textos secundarios en opacidades muy bajas (`/30`-`/45`) a 9-11px sobre fondos oscuros translúcidos. | Probablemente bajo AA para texto pequeño, difícil con baja visión o al sol. | 🟡 Media | Subir el piso de opacidad a `/60` mínimo, verificar caso a caso. | M |
| ADM-15 | `admin/DeviceManager.tsx` | responsive | Botones "ver enlace"/"cambiar pin"/"revocar" con altura real ~32-33px. | Objetivos pequeños para acciones sensibles (revocar acceso). | 🟡 Media | Subir a `py-3` como mínimo. | S |
| ADM-16 | `ConstelacionSolMap.tsx` (paleta) vs `@theme` | estética | Dos colores de la constelación coinciden exactamente con tokens existentes pero están copiados como literales. | Riesgo de desincronía silenciosa si el token cambia. | 🟡 Media | Sustituir por `var(--color-mint)`/`var(--color-amber)`. | S |
| ADM-17 | `app/admin/` (sin `loading.tsx`/`error.tsx`) | flujo | Ningún error de datos real tiene pantalla de marca; cae en el error genérico de Next. | Rompe el lenguaje visual oscuro del resto de la app en el peor momento. | 🟡 Media | `error.tsx` compartido con `Screen tone="ink"`. | S |
| ADM-18 | `ConstelacionSolMap.tsx` (jerarquía) | a11y | Ningún `h1`/`h2`/`h3` en todo el archivo; el nombre del local es un `p`. | La pantalla más importante del panel no tiene encabezado para lectores de pantalla. | 🟡 Media | Convertir el nombre del local en `h1` visualmente idéntico. | S |
| ADM-19 | `AttributionsList.tsx` + `ConstelacionSolMap.tsx` | flujo | No hay un único camino para reconstruir la cadena de un cliente: buscador solo en Visitas, sin enlace a la constelación; la constelación no tiene buscador. | Localizar una cadena concreta toma más pasos de los necesarios y no escala con muchos clientes. | 🟡 Media | Buscador ligero en la constelación, o enlace "ver en constelación" desde cada fila de Visitas. | M |
| ADM-20 | `LoginForm.tsx` + `api/admin/login` | flujo | Mismo mensaje genérico para contraseña incorrecta, rate-limit y cuenta sin acceso al local; sin recuperación de contraseña. | Un dueño con credenciales correctas pero sin acceso cree indefinidamente que escribió mal la contraseña. | 🟠 Alta | Diferenciar los 3 casos + enlace "¿olvidaste tu contraseña?" (reset de Supabase Auth). | M |
| ADM-21 | i18n `admin.attrGuest` | redundancia | Clave definida en 4 idiomas sin ningún componente que la use. | Coste de mantenimiento de traducción sin retorno. | ⚪ Baja | Eliminar la clave de los 4 diccionarios. | S |

**Ya está bien y no se toca:** la fusión de `/admin/embudo` + `/admin/senales` en `/admin/metricas` está limpia y bien razonada; `GateCard` no repite el numerador/denominador del embudo; revocar un dispositivo es corto y seguro; `BottomNav` es un único componente compartido, nunca puede desincronizarse entre las 4 páginas; el grid responsive de puertas/señales en métricas es deliberado y correcto.

---

## Rol 4 — Público/Portal (+ barrido de código muerto)

### Inventario de pantallas

| Pantalla | Propósito | Usuario |
|---|---|---|
| `/` (`app/page.tsx`) | Splash para quien teclea el dominio a pelo | cualquiera |
| `/inicio` | Portal/lanzador a los 5 destinos reales | cualquiera (cliente, barista, dueño) |
| `/como-funciona` | Explica el flujo invitación→facturación | nominalmente staff, enlazado públicamente |
| `/privacidad` | Texto de tratamiento de datos | cliente o dueño según origen |

### Journeys

**(a) Alguien teclea el dominio a pelo:** ve un titular y una tarjeta de demo, pero **ningún CTA ni enlace en toda la pantalla**; el pie reutiliza literalmente el copy de error 404. No hay login/signup real: un cliente nuevo solo entra por QR físico o enlace de invitación, y `/` no menciona ninguna de las dos vías. El propio comentario del archivo admite "nadie llega aquí" — es, en la práctica, una esquina huérfana del flujo real.

**(b) Alguien abre `/inicio`:** se lee de inmediato como un lanzador; 4 de las 5 tiles coinciden con su destino real, **excepto** "panel", cuya descripción es del embudo antiguo ya retirado (ADM-11/PUB-06).

### Hallazgos

| ID | Pantalla/archivo | Categoría | Qué pasa | Impacto | Severidad | Solución propuesta | Esfuerzo |
|---|---|---|---|---|---|---|---|
| PUB-01 | `app/page.tsx` | flujo/redundancia | El pie reutiliza `t.errors.notFoundBody` ("revisa el enlace…"), pensado para pantallas de error, no de bienvenida. | Suena a que algo falló justo en la portada del producto. | 🟡 Media | Copy propio de cierre en vez de reusar la clave de error. | S |
| PUB-02 | `app/page.tsx` | flujo | Sin ningún `Link`/`Button`/CTA en toda la página; no explica cómo entra realmente un cliente nuevo. | Si alguien sí llega aquí, no tiene forma de avanzar. | ⚪ Baja | Enlace de salida mínimo (código de invitación / volver a `/inicio`). | S |
| PUB-03 | `app/inicio/page.tsx` | responsive | Wrapper móvil `h-dvh overflow-hidden`; en landscape muy bajo el contenido que no cabe se recorta **sin poder hacer scroll**. | Tiles enteras (p. ej. "panel") pueden quedar invisibles e inalcanzables. | 🟠 Alta | Cambiar a `overflow-y-auto`, o media query también por `min-height`. | S |
| PUB-04 | `app/inicio/page.tsx` | responsive/redundancia | No reutiliza `Screen`; reimplementa su propio wrapper con distinto ancho máximo/padding. | En pantallas grandes, `/inicio` queda visiblemente más estrecho que `/como-funciona`/`/privacidad`. | 🟡 Media | Migrar a `Screen` o extenderlo para el grid de 2 columnas. | M |
| PUB-05 | `app/j/[shop]/qr/page.tsx` | responsive/estética | Tampoco usa `Screen`; radio `rounded-[2.5rem]` no coincide con `--radius-card`. | Inconsistencia visual sutil en la tarjeta del cartel QR. | ⚪ Baja | `rounded-[var(--radius-card)]`. | S |
| PUB-06 | i18n `home.panelBody` | redundancia/flujo | Ver ADM-11: mismo hallazgo, la copy del portal describe el panel antiguo. | (mismo que ADM-11) | 🟡 Media | Actualizar la copy. | S |
| PUB-07 | i18n `guide.step5Body` | flujo | "Atribución facturable" en una pantalla pública que cualquier cliente curioso puede abrir. | Jerga interna filtrada a una pantalla de ayuda al cliente. | 🟡 Media | Reescribir en clave de cliente; dejar el término técnico solo en métricas del dueño. | S |
| PUB-08 | `lib/i18n/server.ts`, `proxy.ts` | a11y/flujo | Idioma 100% automático por `Accept-Language`; no existe ningún selector de UI, ni siquiera donde el propio código comenta que "debería estar bien visible" (`/i/[code]`). | Un invitado con navegador en otro idioma queda fijado en español sin forma de cambiarlo. | 🟠 Alta | Selector de idioma real en `TopBar`, priorizando `/i/[code]` y `/j/[shop]`. | M |
| PUB-09 | `app/inicio/page.tsx` | a11y | Sin ningún encabezado semántico (`h1`), a diferencia de `/`, `/como-funciona`, `/privacidad`. | Lector de pantalla sin anuncio de "de qué pantalla se trata" en el portal lanzador. | 🟡 Media | `h1` (visible o `sr-only`) con el título del portal. | S |
| PUB-10 | `ui/TopBar.tsx` | a11y | El enlace "volver" mide ~20-23px de alto real, sin padding propio. | Bajo el mínimo de 24px WCAG 2.2 y muy bajo el recomendado de 44px. | 🟡 Media | Padding vertical directo en el `Link` de vuelta. | S |
| PUB-11 | `ui/Button.tsx` (`sm`) | a11y | ~37-38px de alto, bajo los 44px recomendados. | Botones secundarios algo difíciles de tocar con precisión. | ⚪ Baja | Subir `py` de `sm`, o limitar su uso a acciones secundarias de bajo riesgo. | S |
| PUB-12 | `ConstelacionSolMap.tsx` (paleta) | estética | 12 literales hex, varios duplicando tokens `@theme` existentes. | Desincronía silenciosa si el token cambia. | ⚪ Baja | Referenciar los tokens existentes; extraer el resto como nuevos tokens si se mantienen. | M |
| PUB-13 | 4 archivos distintos (`layout.tsx`, `manifest.ts`, `QrCode.tsx`, `DeviceManager.tsx`) | estética | `#0e1211` (= `--color-ink`) repetido a mano en 4 sitios (APIs que exigen literal). | Hay que recordar actualizar 4 sitios si el tono de grafito cambia. | ⚪ Baja | Constante compartida `INK_HEX` importada en los 4. | S |
| PUB-14 | `ui/Button.tsx` (`ghost`) | estética | Segundo valor "casi-ink" (`rgba(12,18,16,…)`) que convive con el token real. | Deriva imperceptible de paleta. | ⚪ Baja | Derivar del token real o anotar que es intencional. | S |
| PUB-15 | `app/page.tsx` y otras pantallas `tone="aurora"` | a11y | Texto en `ink/65` sobre el degradado `.aurora`, cerca del límite AA en la franja más saturada. | Texto secundario potencialmente difícil de leer según dónde caiga en el degradado. | ⚪ Baja | Verificar contraste real en los 3 focos del degradado; subir opacidad o mover a superficie sólida si falla. | S |

### Código muerto (transversal)

| ID | Qué es | Evidencia | Severidad | Solución propuesta | Esfuerzo |
|---|---|---|---|---|---|
| DEAD-01 | `components/universe/*` (13 archivos) + `app/preview/universo/page.tsx` | Sin ningún enlace de navegación real; sin gateado de producción (a diferencia de `/preview`). | 🟡 Media | Gatear con auth real o env var; si no se usa para comparar, borrar todo el directorio. | M |
| DEAD-02 | `components/admin/ConstelacionMap.tsx` (~700 líneas) | Cero imports fuera de su propio archivo; duplica la paleta de color de `ConstelacionSolMap.tsx`. | ⚪ Baja | Borrar, o mover a rama/documentación si se quiere conservar "por si acaso". | S |
| DEAD-03 | Dependencias `three`, `@react-three/fiber`, `@react-three/drei`, `simplex-noise` (~31MB) | Solo sirven a `components/universe/*` (DEAD-01); la vista real es SVG puro. | 🟡 Media | Retirar del `package.json` en el mismo cambio que DEAD-01. | S |
| DEAD-04 | `public/{file,globe,next,vercel,window}.svg` | SVGs de plantilla de `create-next-app`, sin referencias. | ⚪ Baja | Borrar los 5 archivos. | S |

**Ya está bien y no se toca:** `:focus-visible` único y consistente sin overrides; `QrCode.tsx` accesible pese a ser SVG inyectado; el enlace a `/privacidad` distingue correctamente el origen; iconografía 100% de `components/ui/Icons.tsx` con un solo grosor de trazo; `app/preview/page.tsx` sí está bien gateado a diferencia de `/preview/universo`.

---

## Plan por lotes

Orden: severidad primero, esfuerzo después. Cada lote es un commit.

### Lote 1 — Críticas (S, alto impacto inmediato)
CLI-01 · BAR-01 · ADM-01 · ADM-02

### Lote 2 — Altas de esfuerzo S (rápidas, mucho impacto)
CLI-02 · CLI-03 · CLI-05 · CLI-06 · CLI-08 · BAR-03 · BAR-05 · ADM-06 · PUB-03

### Lote 3 — Altas de esfuerzo M/L (requieren más trabajo, siguen siendo prioridad)
CLI-04 · BAR-02 · BAR-04 · BAR-08 · ADM-03 · ADM-05 · ADM-07 (dead-code, ver Lote 6) · ADM-20 · PUB-08 · ADM-04 (L, la más grande — candidata a lote propio si se quiere aislar)

### Lote 4 — Medias de copy/terminología (bajo riesgo, alto valor de coherencia)
CLI-21 · ADM-08 · ADM-10 · ADM-11/PUB-06 · ADM-12 · ADM-13 · PUB-01 · PUB-07 · PUB-09

### Lote 5 — Medias de a11y/responsive restantes
CLI-07 · CLI-09 · CLI-10 · CLI-12 · CLI-19 · BAR-06 · BAR-07 · BAR-09 · BAR-11 · BAR-15 · BAR-16 · BAR-19 · ADM-09 · ADM-14 · ADM-15 · ADM-17 · ADM-18 · ADM-19 · PUB-04 · PUB-10

### Lote 6 — Código muerto (aislado, riesgo bajo, solo borrar)
DEAD-01 · DEAD-02 · DEAD-03 · DEAD-04

### Lote 7 — Bajas / pasada de tokens y estética (el resto)
Todas las bajas restantes (CLI-11/13/14/16/17/18/20/22/23/24, BAR-10/12/13/14/17/18, ADM-16/21, PUB-02/05/11/12/13/14/15) — se recomienda hacerlo de una sola vez como "pasada de sistema de diseño" en vez de fragmentarlo.

---

*Nada de lo anterior se ha implementado todavía. Quedo a la espera de aprobación para empezar por el Lote 1.*
