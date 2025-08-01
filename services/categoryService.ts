
import { supabase } from "@/lib/supabaseClient"
import { EnrichedCategory } from "@/types/models"
import { Category, CategoryWithType } from "@/types/category"

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

export async function getCategoriesNormal(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*, category_types(name)")
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching categories", error)
    return []
  }

  return data as Category[]
}

// services/categoryService.ts

export async function fetchCategories(): Promise<CategoryWithType[]> {
  // Nota: renombra la relación en el select si lo prefieres: "category_type:category_types(name)"
  const { data, error } = await supabase
    .from("categories")
    .select("*, category_types(id, name)")
    .order("name", { ascending: true })

  if (error) throw error
  return data as CategoryWithType[]
}

export async function createCategory(category: Omit<Category, "id" | "created_at" | "updated_at" | "user_id">): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert([category])
    .select()
    .single() // Te devuelve el objeto creado directamente

  if (error) throw error
  return data as Category
}

export async function updateCategory(id: string, updates: Partial<Omit<Category, "id" | "created_at" | "updated_at">>): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as Category
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id)
  if (error) throw error
}
