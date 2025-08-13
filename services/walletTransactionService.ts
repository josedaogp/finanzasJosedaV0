import { supabase } from '@/lib/supabaseClient'
import { WalletTransaction } from '@/types/models'

/**
 * Crea una nueva transacción de monedero.
 * @param transaction - Objeto con los datos de la transacción.
 * @returns WalletTransaction insertada
 */
export async function createWalletTransaction(transaction: {
  user_id: string
  wallet_id: string
  monthly_ingestion_id?: string | null
  amount: number
  wallet_transaction_type_id: number
  description?: string | null
}): Promise<WalletTransaction> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert([
      {
        ...transaction,
        created_at: new Date().toISOString(),
      }
    ])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as WalletTransaction
}
