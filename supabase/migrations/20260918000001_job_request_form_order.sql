-- ========================================================================================
-- Ordem dos campos do formulário de Requisição de Pessoal
--
-- A migração anterior acrescentou os campos novos no fim do array. Aqui eles voltam para a
-- ordem em que o gestor pensa o pedido (mesma sequência do DEFAULT_FORM_CONFIG):
-- quem pede → o que pede → onde/quando → por quê → perfil.
--
-- Campos customizados criados no editor (keys desconhecidas) são preservados e mantidos ao
-- fim, na ordem atual. Só mexe no singleton; não toca em requisições já enviadas.
-- ========================================================================================

do $$
declare
  atual  jsonb;
  saida  jsonb := '[]'::jsonb;
  k      text;
  elem   jsonb;
  ordem  text[] := array[
    'gestor', 'emailGestor', 'funcao', 'quantidade', 'tipoContratacao',
    'horario', 'local', 'motivo', 'colaboradorSubstituido', 'dataDesligamento',
    'dataInicio', 'salarioPretendido', 'perfil', 'observacoes'
  ];
begin
  select fields into atual from public.job_request_form_config where id = 'singleton';
  if atual is null then
    return;
  end if;

  foreach k in array ordem
  loop
    select value into elem from jsonb_array_elements(atual) where value->>'key' = k limit 1;
    if elem is not null then
      saida := saida || jsonb_build_array(elem);
      elem := null;
    end if;
  end loop;

  for elem in select value from jsonb_array_elements(atual)
  loop
    if not (elem->>'key' = any(ordem)) then
      saida := saida || jsonb_build_array(elem);
    end if;
  end loop;

  update public.job_request_form_config set fields = saida where id = 'singleton';
end $$;
