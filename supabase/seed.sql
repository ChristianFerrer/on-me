-- ============================================================================
-- Seed del piloto. Ejecutar una sola vez tras la migración.
--
-- IMPORTANTE: guarda los dos valores que imprime el SELECT final.
--   · devices.token -> es la URL de alta del barista: /s/<token>
--   · el PIN por defecto es 1234; cámbialo desde el panel antes del piloto.
-- ============================================================================

insert into shops (slug, name, address, hours, default_locale)
values ('madness', 'The Madness', 'Carrer de Verdi 22, Barcelona', '8:00 – 20:00', 'es')
on conflict (slug) do nothing;

-- PIN por defecto '1234'. El hash debe coincidir con lib/crypto.ts:hashPin,
-- que es sha256(pin + APP_SALT); aquí se deja a null a propósito para que
-- lo fije el panel de admin y APP_SALT nunca viaje a la base de datos.
insert into devices (shop_id, name, token)
select id, 'Barra 1', encode(gen_random_bytes(16), 'hex')
from shops
where slug = 'madness'
  and not exists (
    select 1 from devices d where d.shop_id = shops.id and d.name = 'Barra 1'
  );

select s.slug        as shop,
       d.name        as device,
       d.token       as device_token,
       '/s/' || d.token as url_de_alta_del_barista
from devices d
join shops s on s.id = d.shop_id
where s.slug = 'madness';
