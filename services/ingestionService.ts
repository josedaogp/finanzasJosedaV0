import { supabase } from "@/lib/supabaseClient"
import { CategoryExpense, Income, MonthlyIngestion, WalletTransaction, AssetTransaction } from '@/types/models'

interface DistributionRule {
  walletId: string
  type: "percentage" | "fixed"
  value: number
  priority: number
}

export async function saveDistributionRules(
  rules: DistributionRule[],
  userId: string
) {
  // Primero borra todas las reglas previas del usuario (puedes filtrar por mes si procede)
  const { error: deleteError } = await supabase
    .from("distribution_rules")
    .delete()
    .eq("user_id", userId)
    // .eq("month", ...) si es por mes
    // .eq("year", ...) si es por mes

  if (deleteError) {
    return { error: deleteError.message }
  }

  // Inserta todas las reglas nuevas
  const toInsert = rules.map(r => ({
    user_id: userId,
    wallet_id: r.walletId,
    type: r.type,
    value: r.value,
    priority: r.priority,
    // month, year, ... si hace falta
  }))

  const { data, error } = await supabase
    .from("distribution_rules")
    .insert(toInsert)

  if (error) return { error: error.message }

  return { data }
}
interface SaveMonthlyIngestionParams {
  month: number
  year: number
  categoryExpenses: CategoryExpense[]
  incomes: Income[]
  distributionRules?: DistributionRule[]
  userId?: string // opcional, si usas autenticación
}

export async function saveMonthlyIngestion({
  month,
  year,
  categoryExpenses,
  incomes,
  distributionRules,
  userId,
}: SaveMonthlyIngestionParams) {
  // Calcula un ID único para el mes y usuario
  const ingestion_id = `${userId ?? "default"}-${year}-${String(month).padStart(2, "0")}`

  // Prepara el objeto a guardar
  const newIngestion = {
    id: ingestion_id,
    user_id: userId,
    month,
    year,
    category_expenses: categoryExpenses,
    incomes,
    distribution_rules: distributionRules ?? [],
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    // Añade otros campos según tu modelo
  }

  // Busca si existe ya la ingesta de ese mes
  const { data: existing, error: fetchError } = await supabase
    .from("monthly_ingestions")
    .select("id")
    .eq("id", ingestion_id)
    .single()

  if (fetchError && fetchError.code !== "PGRST116") {
    // Error distinto de "no rows found"
    return { error: fetchError.message }
  }

  let result
  if (existing) {
    // Actualiza la existente
    result = await supabase
      .from("monthly_ingestions")
      .update(newIngestion)
      .eq("id", ingestion_id)
      .select()
      .single()
  } else {
    // Inserta nueva
    result = await supabase
      .from("monthly_ingestions")
      .insert([newIngestion])
      .select()
      .single()
  }

  if (result.error) {
    return { error: result.error.message }
  }

  return { data: result.data }
}

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
