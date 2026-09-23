-- Banco de Talentos: opções dos filtros e indicadores do topo numa única chamada.
--
-- Por que uma função: a listagem é paginada no servidor; montar as opções de filtro
-- (estados, cidades, áreas…) buscando todas as linhas esbarraria no limite de linhas do
-- PostgREST quando o banco passar de ~1.000 talentos. Aqui o agrupamento é no Postgres.
--
-- security invoker: roda com as permissões de quem chama (RLS de talentos vale).
-- Aditiva. Aplicar: SUPABASE_DB_URL="..." node scripts/_supabase-apply.mjs \
--   supabase/migrations/20260923180001_talent_crm_facets.sql 20260923180001

create or replace function public.talentos_crm_facets()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with v as materialized (
    select "estado", "cidade", "cargoDesejado", "areas", "origemDetalhe",
           "situacao", "favorito", "createdAt"
    from "talentos_crm"
  ),
  ativos as (select * from v where "situacao" <> 'ARQUIVADO')
  select jsonb_build_object(
    'total',      (select count(*) from ativos),
    'arquivados', (select count(*) from v where "situacao" = 'ARQUIVADO'),
    'favoritos',  (select count(*) from ativos where "favorito"),
    'novosMes',   (select count(*) from ativos
                    where "createdAt" >= (date_trunc('month', now() at time zone 'America/Sao_Paulo')
                                          at time zone 'America/Sao_Paulo')),
    'situacoes',  (select coalesce(jsonb_object_agg("situacao", n), '{}'::jsonb)
                     from (select "situacao", count(*) n from v group by 1) x),
    'estados',    (select coalesce(jsonb_agg(jsonb_build_object('value', "estado", 'count', n) order by "estado"), '[]'::jsonb)
                     from (select "estado", count(*) n from ativos where coalesce("estado", '') <> '' group by 1) x),
    'cidades',    (select coalesce(jsonb_agg(jsonb_build_object('value', "cidade", 'count', n) order by "cidade"), '[]'::jsonb)
                     from (select "cidade", count(*) n from ativos where coalesce("cidade", '') <> '' group by 1) x),
    'cargos',     (select coalesce(jsonb_agg(jsonb_build_object('value', "cargoDesejado", 'count', n) order by "cargoDesejado"), '[]'::jsonb)
                     from (select "cargoDesejado", count(*) n from ativos where coalesce("cargoDesejado", '') <> '' group by 1) x),
    'areas',      (select coalesce(jsonb_agg(jsonb_build_object('value', a, 'count', n) order by a), '[]'::jsonb)
                     from (select a, count(*) n from ativos, unnest("areas") a where coalesce(a, '') <> '' group by 1) x),
    'origens',    (select coalesce(jsonb_agg(jsonb_build_object('value', "origemDetalhe", 'count', n) order by n desc), '[]'::jsonb)
                     from (select "origemDetalhe", count(*) n from ativos where "origemDetalhe" is not null group by 1) x)
  );
$$;

revoke execute on function public.talentos_crm_facets() from public, anon;
grant execute on function public.talentos_crm_facets() to authenticated;
