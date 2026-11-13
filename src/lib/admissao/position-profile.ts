// Marcações do cargo da admissão (Configurações › Cadastros › Cargos) para o formulário
// digital: uniforme operacional, motorista (MOPP) e operador de empilhadeira.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PositionProfile } from './form-config'

/** null = admissão sem cargo (o formulário pergunta ao candidato, como antes). */
export async function loadPositionProfile(
  client: SupabaseClient,
  positionId: string | null
): Promise<PositionProfile | null> {
  if (!positionId) return null
  const { data } = await client
    .from('admission_positions')
    .select('usesOperationalUniform, isDriver, isForkliftOperator')
    .eq('id', positionId)
    .maybeSingle()
  if (!data) return null
  return {
    usesOperationalUniform: !!data.usesOperationalUniform,
    isDriver: !!data.isDriver,
    isForkliftOperator: !!data.isForkliftOperator,
  }
}
