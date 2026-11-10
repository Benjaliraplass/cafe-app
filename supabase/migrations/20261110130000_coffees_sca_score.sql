-- Puntaje SCA (escala de taza 80-100) leído de la etiqueta o ingresado a mano.
alter table public.coffees add column sca_score numeric(5, 2)
  check (sca_score is null or (sca_score >= 60 and sca_score <= 100));
comment on column public.coffees.sca_score is 'Puntaje de taza SCA (60-100), opcional';
