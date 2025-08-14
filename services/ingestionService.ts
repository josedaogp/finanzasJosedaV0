import { supabase } from "@/lib/supabaseClient"
import { CategoryExpense, Income, MonthlyIngestion, WalletTransaction, AssetTransaction } from '@/types/models'

interface DistributionRule {
  walletId: string
  type: "percentage" | "fixed"
  value: number
  priority: number
}

// export async function saveDistributionRules(
//   rules: DistributionRule[],
//   userId: string
// ) {
//   // Primero borra todas las reglas previas del usuario (puedes filtrar por mes si procede)
//   const { error: deleteError } = await supabase
//     .from("distribution_rules")
//     .delete()
//     .eq("user_id", userId)
//     // .eq("month", ...) si es por mes
//     // .eq("year", ...) si es por mes

//   if (deleteError) {
//     return { error: deleteError.message }
//   }

//   // Inserta todas las reglas nuevas
//   const toInsert = rules.map(r => ({
//     user_id: userId,
//     wallet_id: r.walletId,
//     type: r.type,
//     value: r.value,
//     priority: r.priority,
//     // month, year, ... si hace falta
//   }))

//   const { data, error } = await supabase
//     .from("distribution_rules")
//     .insert(toInsert)

//   if (error) return { error: error.message }

//   return { data }
// }
// interface SaveMonthlyIngestionParams {
//   month: number
//   year: number
//   categoryExpenses: CategoryExpense[]
//   incomes: Income[]
//   distributionRules?: DistributionRule[]
//   userId?: string // opcional, si usas autenticación
// }

type MonthlyIngestionParams = {
  user_id: string // UUID del usuario (obligatorio)
  month: number   // 1..12
  year: number    // >= 2000
  date?: string   // Opcional: por defecto, se calcula
}
export async function saveMonthlyIngestion({
  user_id,
  month,
  year,
  date, // Opcional
}: MonthlyIngestionParams): Promise<{ data?: any; error?: string }> {
  try {
    // Calcula la fecha si no se pasa (primer día del mes)
    const finalDate =
      date || `${year}-${String(month).padStart(2, "0")}-01`

    // Busca si ya existe para evitar duplicados por user/mes/año (UNIQUE en BBDD)
    const { data: existing, error: fetchError } = await supabase
      .from("monthly_ingestions")
      .select("id")
      .eq("user_id", user_id)
      .eq("month", month)
      .eq("year", year)
      .single()

    if (fetchError && fetchError.code !== "PGRST116") {
      // "PGRST116" = Not found (ok si es nuevo)
      return { error: fetchError.message }
    }

    let result
    if (existing) {
      // Si ya existe, simplemente devuélvelo (o podrías actualizar, según tu lógica)
      return { data: existing }
    } else {
      // Si no existe, lo insertamos
      const { data, error } = await supabase
        .from("monthly_ingestions")
        .insert([
          {
            user_id,
            month,
            year,
            date: finalDate,
          },
        ])
        .select()
        .single()

      if (error) return { error: error.message }
      return { data }
    }
  } catch (err: any) {
    return { error: err?.message || "Unknown error" }
  }
}

export async function getMonthlyIngestionsIndex(): Promise<{ year: number; month: number }[]> {
  const { data: u, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw new Error(authErr.message)
  const userId = u?.user?.id
  if (!userId) return []

  const { data, error } = await supabase
    .from("monthly_ingestions")
    .select("year, month")
    .eq("user_id", userId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as { year: number; month: number }[]
}



export async function getMonthlyIngestion(year: number, month: number) {
  // Obtiene el user_id vigente (respetando RLS multiusuario)
  const { data: u, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw new Error(authErr.message)
  const userId = u?.user?.id
  if (!userId) return null

  // Embedding de hijos; el alias "expenses" y "incomes" es solo para comodidad
  const { data, error } = await supabase
    .from("monthly_ingestions")
    .select(`
      id, user_id, year, month, date,
      expenses:category_expenses(*),
      incomes:incomes(*, assets(name))
    `)
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    ...data,
    expenses: Array.isArray((data as any).expenses) ? (data as any).expenses : [],
    incomes: Array.isArray((data as any).incomes) ? (data as any).incomes : [],
  }
}



export async function fetchCategoryExpenses(monthly_ingestion_id: string) {
  const { data, error } = await supabase
    .from('category_expenses')
    .select('*')
    .eq('monthly_ingestion_id', monthly_ingestion_id)
  if (error) throw new Error(error.message)
  return data
}

export async function fetchIncomes(monthly_ingestion_id: string) {
  const { data, error } = await supabase
    .from('incomes')
    .select('*')
    .eq('monthly_ingestion_id', monthly_ingestion_id)
  if (error) throw new Error(error.message)
  return data
}

export async function fetchDistributionRules(user_id: string) {
  const { data, error } = await supabase
    .from('distribution_rules')
    .select('*')
    .eq('user_id', user_id)
    .order('priority')
  if (error) throw new Error(error.message)
  return data
}


export async function updateWalletBalance(wallet_id: string, new_balance: number) {
  const { error } = await supabase
    .from('wallets')
    .update({ current_balance: new_balance })
    .eq('id', wallet_id)
  if (error) throw new Error(error.message)
}

export async function fetchMonthlyIngestion(user_id: string, month: number, year: number) {
  const { data, error } = await supabase
    .from('monthly_ingestions')
    .select('*')
    .eq('user_id', user_id)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// 1. Crear nueva ingesta mensual
export async function createMonthlyIngestion(payload: {
  user_id: string,
  month: number,
  year: number,
  date: string, // ISO: '2025-01-01'
}): Promise<MonthlyIngestion> {
  const { data, error } = await supabase
    .from('monthly_ingestions')
    .insert([payload])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as MonthlyIngestion
}

// 2. Registrar gasto por categoría (uno por cada categoría con gasto)
export async function createCategoryExpense(payload: Omit<CategoryExpense, 'id' | 'created_at'>): Promise<CategoryExpense> {
  const { data, error } = await supabase
    .from('category_expenses')
    .insert([payload])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CategoryExpense
}

// 3. Registrar ingreso (uno por cada ingreso)
export async function createIncome(payload: Omit<Income, 'id' | 'created_at'>): Promise<Income> {
  const { data, error } = await supabase
    .from('incomes')
    .insert([payload])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Income
}

// 4. Crear transacción de monedero (uno por cada movimiento de monedero)
export async function createWalletTransaction(payload: Omit<WalletTransaction, 'id' | 'created_at'>): Promise<WalletTransaction> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert([payload])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as WalletTransaction
}

// 5. Crear transacción de bien/asset (uno por cada movimiento de asset, normalmente para ingresos)
export async function createAssetTransaction(payload: Omit<AssetTransaction, 'id' | 'created_at'>): Promise<AssetTransaction> {
  const { data, error } = await supabase
    .from('asset_transactions')
    .insert([payload])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as AssetTransaction
}

// 6. Actualizar/crear reglas de distribución (opcional)
export async function upsertDistributionRule(rule: Omit<DistributionRule, 'id' | 'created_at' | 'updated_at'>): Promise<DistributionRule> {
  const { data, error } = await supabase
    .from('distribution_rules')
    .upsert([rule], { onConflict: 'user_id,wallet_id' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as DistributionRule
}

// Importacion de meses
// Elimina TODOS los gastos por categoría de una ingesta (idempotente)
export async function deleteCategoryExpensesByIngestionId(monthly_ingestion_id: string) {
  const { supabase } = await import("@/lib/supabaseClient")
  const { data: u, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw new Error(authErr.message)
  const userId = u?.user?.id
  if (!userId) return

  const { error } = await supabase
    .from("category_expenses")
    .delete()
    .eq("user_id", userId)
    .eq("monthly_ingestion_id", monthly_ingestion_id)

  if (error) throw new Error(error.message)
}

// Elimina TODOS los ingresos de una ingesta (idempotente)
export async function deleteIncomesByIngestionId(monthly_ingestion_id: string) {
  const { supabase } = await import("@/lib/supabaseClient")
  const { data: u, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw new Error(authErr.message)
  const userId = u?.user?.id
  if (!userId) return

  const { error } = await supabase
    .from("incomes")
    .delete()
    .eq("user_id", userId)
    .eq("monthly_ingestion_id", monthly_ingestion_id)

  if (error) throw new Error(error.message)
}
