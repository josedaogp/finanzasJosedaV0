import { supabase } from "@/lib/supabaseClient"
import { Wallet } from "@/types/models"

export async function fetchWallets(userId?: string): Promise<Wallet[]> {
  let query = supabase.from("wallets").select("*")
  if (userId) query = query.eq("user_id", userId)
  const { data, error } = await query

  if (error) {
    console.error("Error al obtener wallets:", error)
    return []
  }

  return data || []
}

// Crea un nuevo monedero
export async function createWallet(wallet: Omit<Wallet, 'id' | 'created_at' | 'updated_at'>): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .insert([wallet])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Wallet
}

// Actualiza un monedero
export async function updateWallet(id: string, updates: Partial<Omit<Wallet, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Wallet
}

// Elimina un monedero
export async function deleteWallet(id: string): Promise<void> {
  const { error } = await supabase
    .from('wallets')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
