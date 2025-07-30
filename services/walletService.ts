import { supabase } from "@/lib/supabaseClient"
import { Wallet } from "@/types/models"

export async function fetchWallets(): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")

  if (error) {
    console.error("Error al obtener wallets:", error)
    return []
  }

  return data || []
}
