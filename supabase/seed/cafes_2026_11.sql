-- Seed inicial de cafeterías (lista de Benjamín, 2026-11-09). Coordenadas de Google Maps, direcciones de Google/OSM.
-- Se cargan aprobadas a nombre del admin. Idempotente por slug (actualiza datos si cambian).
with admin as (select id from public.profiles where role = 'admin' order by created_at limit 1)
insert into public.cafes (slug, name, kind, address, comuna, city, region, lat, lng, status, created_by, approved_by, approved_at)
select v.slug, v.name, v.kind, v.address, v.comuna, v.city, v.region, v.lat, v.lng, 'approved', admin.id, admin.id, now()
from admin, (values
  ('tangara-coffee-roasters-pichilemu', 'Tángara Coffee Roasters', 'both', 'Av. Comercio 2241, Centro Comercial Alto Mar', 'Pichilemu', 'Pichilemu', 'O''Higgins', -34.4053924, -72.0258261),
  ('cardumen-cafe-los-alerces', 'Cardumen Café Los Alerces', 'cafe', 'Los Alerces', 'Pichilemu', 'Pichilemu', 'O''Higgins', -34.3907946, -72.0140612),
  ('cardumen-cafe-centro', 'Cardumen Café', 'cafe', 'Aníbal Pinto 96', 'Pichilemu', 'Pichilemu', 'O''Higgins', -34.3865321, -72.0043875),
  ('el-brunch-pichilemu', 'El Brunch', 'cafe', 'Av. Daniel Ortúzar 314', 'Pichilemu', 'Pichilemu', 'O''Higgins', -34.3860393, -72.0033575),
  ('la-pastora-suecia', 'La Pastora Coffee House', 'cafe', 'Suecia 264', 'Providencia', 'Santiago', 'Metropolitana', -33.4230853, -70.606796),
  ('la-pastora-antonio-varas', 'La Pastora Coffee House', 'cafe', 'Antonio Varas 1480', 'Providencia', 'Santiago', 'Metropolitana', -33.4405229, -70.6129831),
  ('la-pastora-roasters-barrio-italia', 'La Pastora Coffee Roasters', 'both', 'Condell 1483', 'Providencia', 'Santiago', 'Metropolitana', -33.448339, -70.6256704),
  ('la-pastora-parque-bustamante', 'La Pastora', 'cafe', 'Ramón Carnicer 65', 'Providencia', 'Santiago', 'Metropolitana', -33.4401389, -70.6328875),
  ('cafecito-house', 'Cafecito House', 'cafe', 'Julio Prado 838', 'Providencia', 'Santiago', 'Metropolitana', -33.4407378, -70.6224891),
  ('cafecito-house-2', 'Cafecito House 2', 'cafe', 'Av. Los Leones 2523', 'Providencia', 'Santiago', 'Metropolitana', -33.4422416, -70.5997768),
  ('id-coffee', 'ID Coffee', 'cafe', 'Caupolicán 521', 'Ñuñoa', 'Santiago', 'Metropolitana', -33.4482834, -70.6235838),
  ('the-elephant-coffee-napoleon', 'The Elephant Coffee', 'cafe', 'Napoleón 2898', 'Las Condes', 'Santiago', 'Metropolitana', -33.4184743, -70.5992684),
  ('the-elephant-coffee-las-hortensias', 'The Elephant Coffee', 'cafe', 'Las Hortensias 2887', 'Providencia', 'Santiago', 'Metropolitana', -33.4261917, -70.5942895),
  ('we-are-four-pedro-de-valdivia', 'We Are Four Coffee Roasters (WR4)', 'both', 'Av. Pedro de Valdivia 51', 'Providencia', 'Santiago', 'Metropolitana', -33.4243502, -70.6123134),
  ('we-are-four-los-leones', 'We Are Four Coffee Roasters (WR4)', 'cafe', 'Av. Los Leones 952', 'Providencia', 'Santiago', 'Metropolitana', -33.4284461, -70.6029052),
  ('we-are-four-apoquindo', 'We Are Four Coffee Roasters (WR4)', 'roastery', 'Av. Apoquindo 2929', 'Las Condes', 'Santiago', 'Metropolitana', -33.4179194, -70.5993586),
  ('mana-cafe', 'Maña Café', 'cafe', 'Bombero Salas 1359', 'Santiago Centro', 'Santiago', 'Metropolitana', -33.4417197, -70.6557902),
  ('cafe-triciclo', 'Café Triciclo', 'cafe', 'Santo Domingo 598', 'Santiago Centro', 'Santiago', 'Metropolitana', -33.4356729, -70.645814),
  ('cafe-altura-manuel-montt', 'Café Altura', 'cafe', 'Manuel Montt 053', 'Providencia', 'Santiago', 'Metropolitana', -33.4282304, -70.6205699),
  ('cafe-altura-la-vega', 'Café Altura La Vega', 'cafe', 'Dávila Baeza 700, Galpón Chacareros, La Vega Central', 'Recoleta', 'Santiago', 'Metropolitana', -33.4283652, -70.6482668),
  ('cafe-altura-paseo-san-agustin', 'Café Altura Paseo San Agustín', 'cafe', 'Moneda 877', 'Santiago Centro', 'Santiago', 'Metropolitana', -33.4416759, -70.6488521),
  ('cafe-altura-bulnes', 'Café Altura Bulnes', 'cafe', 'Paseo Bulnes 122', 'Santiago Centro', 'Santiago', 'Metropolitana', -33.4469396, -70.6529028),
  ('cafe-altura-mut', 'Café Altura MUT', 'cafe', 'Av. Apoquindo 2730, piso -2', 'Las Condes', 'Santiago', 'Metropolitana', -33.4176822, -70.6012411),
  ('coffee-culture-maipu', 'Coffee Culture Coffee Roasters (CCCR)', 'both', 'Gral. Ordóñez 199', 'Maipú', 'Santiago', 'Metropolitana', -33.5077625, -70.7599075),
  ('coffee-culture-la-paz', 'Coffee Culture Coffee Roasters (CCCR)', 'cafe', 'Av. La Paz 482', 'Recoleta', 'Santiago', 'Metropolitana', -33.4252454, -70.6514521),
  ('bourbon-coffee', 'Bourbon Coffee Tostadores de Café', 'both', 'Jaime Guzmán Errázuriz 3399', 'Ñuñoa', 'Santiago', 'Metropolitana', -33.4476629, -70.5934143),
  ('draga-coffee-roman-diaz', 'Draga Coffee', 'cafe', 'Román Díaz 56', 'Providencia', 'Santiago', 'Metropolitana', -33.4308868, -70.6222371),
  ('draga-coffee-huelen', 'Draga Coffee', 'cafe', 'Huelén 71', 'Providencia', 'Santiago', 'Metropolitana', -33.4317209, -70.6230032),
  ('felix-cafe', 'Felix Café', 'cafe', 'Coyancura 2223', 'Providencia', 'Santiago', 'Metropolitana', -33.4236939, -70.6084217),
  ('bassotto-cafe', 'Bassotto Café', 'cafe', 'Pdte. Riesco 6007, locales 8 y 9', 'Las Condes', 'Santiago', 'Metropolitana', -33.4027013, -70.5704902),
  ('cafe-black-mamba', 'Café Black Mamba', 'cafe', 'Eliodoro Yáñez 1200', 'Providencia', 'Santiago', 'Metropolitana', -33.4333121, -70.6183506),
  ('puelo-coffee-roasters', 'Puelo Coffee Roasters', 'both', 'Navidad 1526', 'Vitacura', 'Santiago', 'Metropolitana', -33.4042749, -70.5960713),
  ('mirlo-cafeteria', 'Mirlo Cafetería', 'cafe', 'Eliodoro Yáñez 961', 'Providencia', 'Santiago', 'Metropolitana', -33.4337872, -70.6223947)
) as v(slug, name, kind, address, comuna, city, region, lat, lng)
on conflict (slug) do update set
  name = excluded.name, kind = excluded.kind, address = excluded.address, comuna = excluded.comuna, city = excluded.city,
  region = excluded.region, lat = excluded.lat, lng = excluded.lng;
