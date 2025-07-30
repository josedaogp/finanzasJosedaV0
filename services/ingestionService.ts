import { supabase } from "@/lib/supabaseClient"
import { MonthlyIngestion, Income, CategoryExpense } from "@/types/models"

export async function getMonthlyIngestion(year: number, month: number) {
  const { data: ingestion } = await supabase
    .from("monthly_ingestions")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .single()

  if (!ingestion) return null

  const { data: expenses } = await supabase
    .from("category_expenses")
    .select("*")
    .eq("monthly_ingestion_id", ingestion.id)

  const { data: incomes } = await supabase
    .from("incomes")
    .select("*")
    .eq("monthly_ingestion_id", ingestion.id)

  return {
    ...ingestion,
    expenses: expenses || [],
    incomes: incomes || [],
  }
}
