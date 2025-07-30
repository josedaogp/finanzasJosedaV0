import { supabase } from "@/lib/supabaseClient"
import { CategoryType } from "@/types/models"

export async function fetchCategoryTypes(): Promise<CategoryType[]> {
  const { data, error } = await supabase.from("category_types").select("*")

  if (error) {
    console.error("Error al obtener los tipos de categoría:", error)
    return []
  }

  return data || []
}
