-- Seed de recetas destacadas. Parámetros públicos de cada autor, redactados en nuestras palabras y con enlace a la fuente.
-- Idempotente por slug. created_by = admin.
with admin as (select id from public.profiles where role = 'admin' order by created_at limit 1)
insert into public.featured_recipes (slug, title, author, author_role, country, event, method_family, dripper, params, steps, story, source_url, is_published, sort_order, created_by)
select v.slug, v.title, v.author, v.author_role, v.country, v.event, v.method_family, v.dripper, v.params::jsonb, v.steps::jsonb, v.story, v.source_url, true, v.sort_order, admin.id
from admin, (values
(
  'v60-hoffmann-ultimate', 'V60 para dos: la técnica de James Hoffmann', 'James Hoffmann', 'campeon', 'Reino Unido', 'Campeón mundial de baristas 2007', 'conico', 'V60',
  '{"dose_g":30,"water_g":500,"ratio":"1:16,7","water_temp_c":96,"grind":"Media fina","grind_reference":"Agua recién hervida para tuestes claros; algo más fría (90-94 °C) para tuestes medios y oscuros","total_time":"3:30"}',
  '[{"time":"0:00","action":"Moja el filtro, agrega 30 g de café, haz un hoyo en el centro y vierte 60 g de agua. Gira el cono con suavidad para mojar todo el café."},{"time":"0:45","action":"Vierte en círculos hasta llegar a 300 g (tienes 30 segundos)."},{"time":"1:15","action":"Vierte más lento hasta completar 500 g (también en 30 segundos)."},{"time":"1:45","action":"Con una cuchara, revuelve una vez en un sentido y una vez en el otro para soltar el café pegado a las paredes."},{"time":"2:00","action":"Deja bajar un poco el nivel y da un giro suave al cono para que la cama quede plana."},{"time":"3:30","action":"La cama debe quedar plana y el goteo terminar cerca de este tiempo. Sirve."}]',
  'La idea es sacarle la variabilidad al método: dos vertidos continuos, agitación mínima y controlada (una revuelta y un giro) y una cama plana al final. Con 60 g de café por litro y agua muy caliente para tuestes claros, el resultado es una taza dulce y limpia, repetible día tras día. Si sabe astringente, muele más grueso; si sabe plano o ácido, más fino.',
  'https://www.youtube.com/watch?v=AI4ynXzkSQo', 10
),
(
  'v60-kasuya-4-6', 'Método 4:6 de Tetsu Kasuya', 'Tetsu Kasuya', 'campeon', 'Japón', 'Campeón mundial de filtrado (WBrC) 2016', 'conico', 'V60',
  '{"dose_g":20,"water_g":300,"ratio":"1:15","water_temp_c":92,"grind":"Gruesa","grind_reference":"Más gruesa que lo habitual para V60, parecida a sal gruesa","total_time":"3:30"}',
  '[{"time":"0:00","action":"Primer vertido: 60 g de agua. Espera a que drene casi por completo."},{"time":"0:45","action":"Segundo vertido: 60 g. Con estos dos primeros (el 40 %) se define el balance entre acidez y dulzor."},{"time":"1:30","action":"Tercer vertido: 60 g. Desde aquí (el 60 % restante) se define la intensidad."},{"time":"2:15","action":"Cuarto vertido: 60 g."},{"time":"3:00","action":"Quinto vertido: 60 g, hasta completar 300 g."},{"time":"3:30","action":"Retira el cono cuando termine de drenar y sirve."}]',
  'El agua se divide en dos bloques: el primer 40 % controla el sabor y el 60 % restante controla la fuerza. Si quieres más dulzor, haz el primer vertido más grande y el segundo más chico; si quieres más acidez, al revés. Si quieres una taza más suave, reparte el 60 % final en menos vertidos. La molienda gruesa permite varios vertidos sin sobreextraer.',
  'https://en.philocoffea.com/blogs/blog/coffee-brewing-method', 20
),
(
  'v60-wendelboe', 'V60 estilo nórdico de Tim Wendelboe', 'Tim Wendelboe', 'campeon', 'Noruega', 'Campeón mundial de baristas 2004', 'conico', 'V60',
  '{"dose_g":15,"water_g":250,"ratio":"1:16,7","water_temp_c":96,"grind":"Media fina","grind_reference":"Agua recién hervida, dejada reposar unos segundos","total_time":"2:45"}',
  '[{"time":"0:00","action":"Enjuaga el filtro con agua caliente y agrega 15 g de café molido."},{"time":"0:00","action":"Vierte unos 50 g de agua para mojar todo el café y deja florecer."},{"time":"0:30","action":"Vierte el resto del agua de forma continua y pareja hasta completar 250 g."},{"time":"1:15","action":"Termina de verter. Evita revolver o agitar."},{"time":"2:45","action":"El goteo debería terminar entre 2:30 y 3:00. Sirve de inmediato."}]',
  'La escuela nórdica busca claridad: tuestes claros, agua cerca del hervor, un solo vertido continuo después del bloom y nada de agitación. Menos intervención significa menos variables y una taza más brillante y limpia. Si el goteo termina antes de 2:30, muele más fino; si pasa de 3:00, más grueso.',
  'https://timwendelboe.no/brewing-guides', 30
),
(
  'aeropress-hoffmann', 'Aeropress sin vueltas, de James Hoffmann', 'James Hoffmann', 'campeon', 'Reino Unido', 'Campeón mundial de baristas 2007', 'inmersion', 'Aeropress',
  '{"dose_g":11,"water_g":200,"ratio":"1:18","water_temp_c":99,"grind":"Media fina","grind_reference":"Método normal (no invertido). Para tuestes oscuros, agua a 85-90 °C","total_time":"2:30"}',
  '[{"time":"0:00","action":"Coloca el filtro de papel sin enjuagar, arma la Aeropress sobre la taza y agrega 11 g de café."},{"time":"0:00","action":"Vierte 200 g de agua recién hervida, rápido y sin bloom."},{"time":"0:10","action":"Pon el émbolo apenas encajado para que no gotee. No revuelvas."},{"time":"2:00","action":"Retira el émbolo, gira la Aeropress con suavidad para que el café se asiente."},{"time":"2:30","action":"Vuelve a poner el émbolo y presiona lento, unos 30 segundos. Detente al escuchar el aire."}]',
  'Contra la intuición, Hoffmann propone agua hirviendo, nada de agitación, un tiempo de contacto largo y una presión lenta. El filtro de papel y la inmersión hacen el resto: una taza limpia, dulce y muy tolerante a errores. Usar un ratio largo (1:18) evita que quede pesada.',
  'https://www.youtube.com/watch?v=j6VlT_jUVPc', 40
),
(
  'prensa-francesa-hoffmann', 'Prensa francesa sin barro, de James Hoffmann', 'James Hoffmann', 'campeon', 'Reino Unido', 'Campeón mundial de baristas 2007', 'inmersion', 'Prensa francesa',
  '{"dose_g":30,"water_g":500,"ratio":"1:16,7","water_temp_c":96,"grind":"Media","grind_reference":"Más fina que la molienda gruesa tradicional de prensa","total_time":"9:00"}',
  '[{"time":"0:00","action":"Agrega 30 g de café y vierte 500 g de agua recién hervida. No revuelvas."},{"time":"4:00","action":"Rompe la costra con una cuchara y revuelve con suavidad."},{"time":"4:30","action":"Retira con dos cucharas la espuma y los granos que flotan."},{"time":"9:00","action":"Coloca la tapa, baja el émbolo solo hasta tocar el líquido, sin presionar el café. Sirve despacio y deja el último sorbo en la prensa."}]',
  'El truco está en no presionar: tras romper la costra y retirar la espuma, los finos se asientan en el fondo durante la espera larga. Al servir sin empujar el émbolo, la taza sale limpia, dulce y sin sedimento, sin perder el cuerpo que caracteriza a la prensa.',
  'https://www.youtube.com/watch?v=st571DYYTR8', 50
),
(
  'kalita-wave-dripo', 'Kalita Wave de fondo plano, receta base de Dripo', 'Dripo', 'otro', 'Chile', null, 'flat', 'Kalita Wave',
  '{"dose_g":20,"water_g":320,"ratio":"1:16","water_temp_c":94,"grind":"Media","grind_reference":"Un punto más gruesa que en V60","total_time":"3:30"}',
  '[{"time":"0:00","action":"Enjuaga el filtro y agrega 20 g de café. Vierte 50 g de agua y deja florecer."},{"time":"0:45","action":"Vierte en pulsos de 60 g, con calma, manteniendo el nivel de agua bajo y evitando las paredes."},{"time":"1:30","action":"Sigue con pulsos de 60 g cada 30-40 segundos hasta completar 320 g."},{"time":"2:30","action":"Último vertido. No revuelvas ni gires."},{"time":"3:30","action":"El goteo debe terminar cerca de este tiempo. Sirve."}]',
  'El fondo plano reparte el agua de manera más pareja que un cono, así que la receta es tolerante: vertidos en pulsos regulares, poca agitación y una molienda apenas más gruesa que en V60. Es el método que recomendamos para empezar con cafés lavados de Centroamérica y Colombia.',
  null, 60
),
(
  'espresso-base-dripo', 'Espresso de especialidad, punto de partida', 'Dripo', 'otro', 'Chile', null, 'espresso', 'Espresso',
  '{"dose_g":18,"yield_g":38,"ratio":"1:2,1","water_temp_c":93,"grind":"Fina","pressure_bar":9,"total_time":"0:28"}',
  '[{"time":"0:00","action":"Muele 18 g directo al portafiltro de 18-20 g. Distribuye con golpes suaves o un distribuidor."},{"time":"0:00","action":"Prensa parejo y firme, sin girar."},{"time":"0:00","action":"Inicia la extracción. Las primeras gotas deberían aparecer entre los 5 y 8 segundos."},{"time":"0:28","action":"Detén la extracción al llegar a 38 g en la balanza (25-32 s es el rango). Si corre más rápido, muele más fino; más lento, más grueso."}]',
  'Un ratio 1:2 a 1:2,2 con tuestes de especialidad entrega dulzor y claridad sin perder cuerpo. Para tuestes muy claros, prueba alargar a 1:2,5 y subir 1 °C; para tuestes medios, baja la temperatura a 91-92 °C. Ajusta siempre una variable a la vez.',
  null, 70
)
) as v(slug, title, author, author_role, country, event, method_family, dripper, params, steps, story, source_url, sort_order)
on conflict (slug) do update set
  title = excluded.title, author = excluded.author, author_role = excluded.author_role, country = excluded.country, event = excluded.event,
  method_family = excluded.method_family, dripper = excluded.dripper, params = excluded.params, steps = excluded.steps, story = excluded.story,
  source_url = excluded.source_url, sort_order = excluded.sort_order;
