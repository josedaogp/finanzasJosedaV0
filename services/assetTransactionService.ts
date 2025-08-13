import { supabase } from '@/lib/supabaseClient'
import { Asset } from '@/types/models'

/**
 * Crea una nueva transacción de bien (asset).
 * @param transaction - Objeto con los datos de la transacción.
 * @returns Transacción insertada
 */
export async function createAssetTransaction(transaction: {
  user_id: string
  asset_id: string
  monthly_ingestion_id?: string | null
  amount: number
  asset_transaction_type_id: number
  description?: string | null
}): Promise<any> {
  const { data, error } = await supabase
    .from('asset_transactions')
    .insert([
      {
        ...transaction,
        created_at: new Date().toISOString(),
      }
    ])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}
