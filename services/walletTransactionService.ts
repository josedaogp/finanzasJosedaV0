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

export async function fetchWalletTransactionsByIngestionIds(ingestionIds: string[]) {
  if (!ingestionIds || ingestionIds.length === 0) return []

  // Asegura el user_id actual (RLS)
  const { data: u, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw new Error(authErr.message)
  const userId = u?.user?.id
  if (!userId) return []

  // Traer transacciones vinculadas a esas ingestas
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id, user_id, wallet_id, monthly_ingestion_id, amount, created_at")
    .eq("user_id", userId)
    .in("monthly_ingestion_id", ingestionIds)
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

