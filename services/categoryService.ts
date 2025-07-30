
import { supabase } from "@/lib/supabaseClient"
import { EnrichedCategory } from "@/types/models"

export async function getCategories(): Promise<EnrichedCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*, category_types(name)")
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching categories", error)
    return []
  }

  return data as EnrichedCategory[]
}
