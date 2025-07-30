import { createClient } from '@supabase/supabase-js'
import { Asset } from '@/types/models'

// Usa tu instancia global de Supabase si la tienes, si no deja esto:
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Obtiene todos los bienes del usuario
export async function fetchAssets(userId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data as Asset[]
}

// Crea un bien nuevo
export async function createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Promise<Asset> {
  const { data, error } = await supabase
    .from("assets")
    .insert([asset])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Asset
}

// Edita bien existente
export async function updateAsset(id: string, updates: Partial<Omit<Asset, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<Asset> {
  const { data, error } = await supabase
    .from("assets")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Asset
}

// Elimina bien
export async function deleteAsset(id: string): Promise<void> {
  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
