import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_FORM_CONFIG, mergeConfig, type FormConfig } from './form-config'

// Carrega a configuração do formulário de admissão do banco (linha única
// `admission_form_config#default`). Cai no padrão se não houver linha ou erro.
export async function loadFormConfig(): Promise<FormConfig> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('admission_form_config')
      .select('config')
      .eq('id', 'default')
      .maybeSingle()
    if (data?.config) return mergeConfig(data.config)
  } catch {
    // silencioso — usa o padrão
  }
  return DEFAULT_FORM_CONFIG
}
