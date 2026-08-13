# OnMe · invito yo

Una cafetería regala unos veinte cafés al día con tarjetas de sellos y no sabe qué le devuelven.
OnMe hace que cada tarjeta completada traiga a **alguien nuevo**, y le dice al dueño exactamente
cuántos volvieron a pagar.

No vendemos fidelización. Vendemos **adquisición con atribución física**.

---

## Qué mide el piloto

El objetivo de v0 no es lanzar un producto: es medir tres números en un local real durante seis
semanas. Todo lo que no sirva para eso queda fuera.

| Puerta | Métrica                                     | Umbral | Muestra mínima |
| ------ | ------------------------------------------- | ------ | -------------- |
| P1     | invitaciones enviadas ÷ tarjetas completadas | > 40 % | 20             |
| P2     | canjes ÷ invitaciones enviadas               | > 25 % | 20             |
| P3     | retornos con compra ÷ canjes                 | > 30 % | 10             |

Más: alta completada > 50 %, escaneo < 3 s, sellos manuales < 15 %.

El panel **nunca enseña un porcentaje como veredicto sin comprobar la muestra**. Con 7 canjes, un
28,6 % no significa nada.

---

## Identidad: asimétrica a propósito

Las tres superficies tienen amenazas distintas, así que tienen autenticación distinta.

| Superficie | Entrada       | Qué protege                          | Cómo                                                       |
| ---------- | ------------- | ------------------------------------ | ---------------------------------------------------------- |
| Cliente    | `/c/[token]`  | una tarjeta de sellos                | token al portador → cookie httpOnly, sin cuenta ni login    |
| Barista    | `/s/[device]` | **la capacidad de acuñar sellos**    | device token canjeado por sesión revocable + PIN de canje   |
| Admin      | `/admin`      | los datos de todos los clientes      | Supabase Auth + pertenencia a `shop_members`                |

**El cliente no crea cuentas.** Nadie pide login para una tarjeta de cartón, y cada campo del alta
cuesta abandono. Robar un token da como mucho un café.

**El barista sí.** `/s/[device]` acuña sellos, confirma cafés gratis y valida canjes: es el secreto
más valioso del sistema y vive en un iPad compartido donde cualquier cliente puede fotografiar la
barra de direcciones. Por eso el token se canjea **una sola vez** por una sesión en cookie httpOnly,
la URL queda limpia, la sesión se guarda hasheada y se puede revocar. El PIN cubre solo las dos
acciones que regalan producto — sellar tiene que seguir siendo un gesto sin fricción.

**Recuperar una tarjeta perdida** no necesita SMS ni email: el barista busca por los cuatro últimos
dígitos y enseña un QR que el cliente escanea con su móvil. La verificación es estar delante del
mostrador, que es más fuerte que un correo electrónico.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # y rellenar
npm run dev
```

### Supabase

1. Proyecto nuevo, región **eu-west** (RGPD: datos en la UE, no negociable).
2. Aplicar `supabase/migrations/0001_init.sql`.
3. Ejecutar `supabase/seed.sql` y **guardar el `devices.token` que imprime** — es la URL de alta
   del barista, `/s/<token>`, y se abre una sola vez por dispositivo.
4. Crear el usuario de admin en Authentication y añadir su fila en `shop_members`:

   ```sql
   insert into shop_members (shop_id, user_id, role)
   select s.id, '<uuid del usuario>', 'owner' from shops s where s.slug = 'madness';
   ```

5. Comprobar en el editor SQL que **ninguna tabla tiene políticas RLS**: con la `anon key` no debe
   poder leerse nada.

### Vercel

`vercel.json` ya deja programado el barrido de atribuciones a las 04:00. Hay que dar de alta las
variables de `.env.example` en el proyecto.

---

## Rutas

| Ruta                | Quién    | Qué                                                    |
| ------------------- | -------- | ------------------------------------------------------ |
| `/j/[shop]`         | cliente  | alta desde el QR de la barra                           |
| `/c/[token]`        | cliente  | canjea el token por cookie y redirige a `/c`           |
| `/c`                | cliente  | la tarjeta, con su QR y su estado                      |
| `/c/invitar`        | cliente  | generar y enviar la invitación                         |
| `/i/[code]`         | invitado | landing y aceptación del café                          |
| `/s/[device]`       | barista  | alta del dispositivo, una vez en su vida               |
| `/s`                | barista  | escáner y resultado                                    |
| `/s/buscar`         | barista  | búsqueda por los cuatro últimos dígitos                |
| `/s/cliente/[id]`   | barista  | ficha, sellado manual y reenvío de tarjeta             |
| `/admin`            | dueño    | embudo y las tres puertas                              |
| `/admin/atribuciones` | dueño  | registro de atribuciones                               |

---

## Arquitectura

- **Next.js 16** (App Router) · TypeScript estricto · Tailwind v4 · Supabase · Vercel.
- **El navegador nunca importa `@supabase/supabase-js`.** Solo hace `fetch` a `/api/*`.
- Toda escritura pasa por el servidor con `service_role`. RLS activo **sin políticas** en todas las
  tablas como red de seguridad.
- La lógica de negocio vive en `lib/scan.ts` y `lib/attribution.ts`, sin Next ni Supabase dentro,
  y se testea directamente (`npm test`).
- `scans` y `attributions` son append-only. Corregir es añadir una fila o marcar `disputed`, nunca
  borrar: la defensa de una factura es poder enseñar el escaneo que la generó.

### Idioma

Español e inglés, resueltos en servidor, sin parpadeo. El idioma va en **cookie y no en la ruta**:
las URLs de OnMe son objetos físicos —un QR pegado en la barra, un enlace de WhatsApp que alguien
guarda un año— y un prefijo de idioma duplicaría la identidad de cada tarjeta.

### Diseño

Sistema «Riso Mediterráneo»: tintas planas saturadas, registro desplazado, trama de semitono y
grano de papel. Fraunces + Archivo + IBM Plex Mono.

El color es funcional. El barista aprende cuatro tintas y lee el resultado de reojo, a dos metros,
con cola detrás:

| Tinta   | Significa                       |
| ------- | ------------------------------- |
| jade    | sello sumado                    |
| azafrán | café gratis por tarjeta completa |
| cobalto | canje de invitación             |
| tomate  | no válido                       |
| humo    | duplicado, no suma              |

---

## Las cinco condiciones del Cliente Nuevo Verificado

Todas obligatorias. Si falla una, no se factura.

1. Teléfono verificado nunca visto antes en ese local.
2. Invitación trazable hasta un padrino con tarjeta completada.
3. Canje escaneado por un dispositivo autorizado del establecimiento.
4. Segunda compra pagada, con **más de 24 h** de separación respecto al canje.
5. Todo dentro de la ventana de 30 días.

Es preferible perder atribuciones legítimas a tener una sola discusión con el dueño sobre si le
estás cobrando de más.

---

## RGPD

- Se tratan nombre, teléfono (hash + últimos cuatro dígitos) e historial de visitas al local.
- **El teléfono completo no se guarda en ningún sitio**, ni aparece en ninguna respuesta de API.
- Base legal: consentimiento, recogido en el alta con texto visible y enlace a `/privacidad`.
- Responsable del tratamiento: **la cafetería**. OnMe es encargado → hace falta un contrato de
  encargo firmado **antes de la primera alta real**.
- Datos alojados en la UE.
- Nunca se enseña a un cliente el consumo de otro. El padrino ve «tu invitado volvió», jamás qué
  compró ni cuándo exactamente.

---

## Comandos

```bash
npm run dev            # desarrollo
npm run build          # build de producción
npm test               # tests de la lógica de negocio
node scripts/icons.mjs # regenerar los iconos de la PWA
```
