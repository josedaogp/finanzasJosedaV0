// /services/monthlyIngestionService.ts
import { supabase } from "@/lib/supabaseClient"
import {
  EnrichedCategory,
  Wallet,
  Asset,
  DistributionRule,
  EnrichedMonthlyIngestion,
  CategoryExpense,
  Income,
} from "@/types/models"

// input: userId, month, year
export async function loadMonthlyIngestionData(userId: string, month: number, year: number) {
  // 1. Fetch all active categories (with type info)
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("*, category_types(name)")
    .eq("user_id", userId)
    .eq("active", true)
    .order("name", { ascending: true })

  // 2. Fetch wallets
  const { data: wallets, error: walletsError } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  // 3. Fetch assets
  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  // 4. Fetch distribution rules
  const { data: distributionRules, error: rulesError } = await supabase
    .from("distribution_rules")
    .select("*")
    .eq("user_id", userId)
    .order("priority", { ascending: true })

  // 5. Fetch the monthly ingestion (if it exists)
  const { data: monthlyIngestionArr, error: ingestionError } = await supabase
    .from("monthly_ingestions")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year)
    .limit(1)

  const monthlyIngestion = monthlyIngestionArr?.[0]

  // 6. Fetch category expenses (if monthlyIngestion exists)
  let categoryExpenses: CategoryExpense[] = []
  let incomes: Income[] = []

  if (monthlyIngestion) {
    // Category expenses
    const { data: expenses, error: expensesError } = await supabase
      .from("category_expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("monthly_ingestion_id", monthlyIngestion.id)
    categoryExpenses = expenses || []

    // Incomes
    const { data: incomesData, error: incomesError } = await supabase
      .from("incomes")
      .select("*")
      .eq("user_id", userId)
      .eq("monthly_ingestion_id", monthlyIngestion.id)
    incomes = incomesData || []
  }

  // Default empty if not found
  return {
    categories: categories as EnrichedCategory[] || [],
    wallets: wallets as Wallet[] || [],
    assets: assets as Asset[] || [],
    distributionRules: distributionRules as DistributionRule[] || [],
    monthlyIngestion: monthlyIngestion as EnrichedMonthlyIngestion | undefined,
    categoryExpenses: categoryExpenses as CategoryExpense[],
    incomes: incomes as Income[],
    // add more if needed
    errors: {
      categoriesError,
      walletsError,
      assetsError,
      rulesError,
      ingestionError,
    },
  }
}

// Puedes poner tipos más detallados si quieres
type SaveMonthlyIngestionArgs = {
  userId: string
  month: number
  year: number
  date: string // ISO YYYY-MM-DD
  categoryExpenses: CategoryExpense[]
  incomes: Income[]
  distributionRules: DistributionRule[]
  categories: EnrichedCategory[]
  wallets: Wallet[]
  assets: Asset[]
}

export async function saveMonthlyIngestion({
  userId, month, year, date,
  categoryExpenses, incomes, distributionRules, categories, wallets, assets
}: SaveMonthlyIngestionArgs): Promise<{ ok: true } | { ok: false, error: string }> {
  // 1. Validaciones
  // --- No duplicar mes/año
  const { data: exist, error: existErr } = await supabase
    .from("monthly_ingestions")
    .select("id")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle()
  if (exist && exist.id) return { ok: false, error: "Ya existe una ingesta para ese mes y año." }

  // --- Categorías acumulativas: si hay gasto > 0 deben tener wallet_id
  for (const exp of categoryExpenses) {
    const cat = categories.find(c => c.id === exp.category_id)
    if (cat && ["gasto_acumulativo", "gasto_mixto", "gasto_acumulativo_opcional"].includes(cat.category_types?.name || "") && exp.amount > 0 && !exp.wallet_id) {
      return { ok: false, error: `La categoría "${cat.name}" requiere un monedero asignado para el gasto.` }
    }
  }

  // --- Ingresos: cada uno >0 debe tener asset_id
  for (const inc of incomes) {
    if (inc.amount > 0 && !inc.asset_id) {
      return { ok: false, error: "Todos los ingresos con cantidad deben tener un bien asociado." }
    }
  }

  // --- Distribución: porcentajes suman 100
  const percRules = distributionRules.filter(r => r.type === "percentage")
  const percTotal = percRules.reduce((a, b) => a + Number(b.value), 0)
  if (percRules.length > 0 && Math.abs(percTotal - 100) > 0.01) {
    return { ok: false, error: `La distribución por porcentaje debe sumar 100%. Ahora suma ${percTotal.toFixed(1)}%` }
  }

  // 2. Crear monthly_ingestion
  const { data: newIngestion, error: ingestionErr } = await supabase
    .from("monthly_ingestions")
    .insert([{
      user_id: userId,
      month, year, date,
    }])
    .select("id")
    .maybeSingle()
  if (ingestionErr || !newIngestion?.id) return { ok: false, error: "Error creando la ingesta mensual." }

  const monthlyIngestionId = newIngestion.id

  // 3. Crear category_expenses
  if (categoryExpenses.length > 0) {
    const mappedExpenses = categoryExpenses.map(exp => ({
      ...exp,
      id: undefined, // dejar que Supabase genere el UUID
      user_id: userId,
      monthly_ingestion_id: monthlyIngestionId,
      created_at: undefined,
    }))
    const { error: expErr } = await supabase.from("category_expenses").insert(mappedExpenses)
    if (expErr) return { ok: false, error: "Error guardando gastos por categoría." }
  }

  // 4. Crear incomes
  if (incomes.length > 0) {
    const mappedIncomes = incomes.map(inc => ({
      ...inc,
      id: undefined,
      user_id: userId,
      monthly_ingestion_id: monthlyIngestionId,
      created_at: undefined,
    }))
    const { error: incErr } = await supabase.from("incomes").insert(mappedIncomes)
    if (incErr) return { ok: false, error: "Error guardando ingresos." }
  }

  // 5. (Opcional) Actualizar distribution_rules (si el usuario los puede editar inline en ingesta)
  // Si lo haces fuera, ignora este bloque.
  // for (const rule of distributionRules) {
  //   ... update/insert según lógica (merge on conflict)
  // }

  // 6. Calcular totales, movimientos y actualizar monederos/bienes (ver abajo ⬇️)

  // Aquí llamamos a la función que realiza los movimientos y updates.
  const updateResult = await applyBalancesAndMovements({
    userId,
    monthlyIngestionId,
    categoryExpenses,
    incomes,
    distributionRules,
    categories,
    wallets,
    assets,
  })
  if (!updateResult.ok) return updateResult

  // 7. Done!
  return { ok: true }
}

// Lógica de movimientos y actualización de saldos (simplificado, adapta si tienes helpers)
async function applyBalancesAndMovements({
  userId,
  monthlyIngestionId,
  categoryExpenses,
  incomes,
  distributionRules,
  categories,
  wallets,
  assets,
}: Omit<SaveMonthlyIngestionArgs, "month" | "year" | "date"> & { monthlyIngestionId: string }) {
  // --- Cálculo de totales
  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalSpent = categoryExpenses.reduce((s, e) => s + Number(e.amount), 0)

  // Excesos cubiertos por monederos
  let excessesCoveredByWallets = 0
  for (const exp of categoryExpenses) {
    const cat = categories.find(c => c.id === exp.category_id)
    const excess = cat ? Math.max(0, Number(exp.amount) - Number(cat.monthly_budget)) : 0
    if (excess > 0 && exp.wallet_id) {
      excessesCoveredByWallets += excess
    }
  }
  const monthlyPot = totalIncome - totalSpent + excessesCoveredByWallets

  // --- Movimientos de monederos: excesos y sobrantes
  let walletMovements: { wallet_id: string, amount: number, type: "excess" | "accumulative", description: string }[] = []
  for (const exp of categoryExpenses) {
    const cat = categories.find(c => c.id === exp.category_id)
    if (!cat) continue
    const excess = Math.max(0, Number(exp.amount) - Number(cat.monthly_budget))
    const surplus = Math.max(0, Number(cat.monthly_budget) - Number(exp.amount))
    // Exceso cubierto por monedero
    if (excess > 0 && exp.wallet_id) {
      walletMovements.push({
        wallet_id: exp.wallet_id,
        amount: -excess,
        type: "excess",
        description: `Exceso en ${cat.name}: €${excess.toFixed(2)}`,
      })
    }
    // Sobrante acumulativo (si la cat es acumulativa)
    const isAccumulative = ["gasto_acumulativo", "gasto_mixto", "gasto_acumulativo_opcional"].includes(cat.category_types?.name || "")
    if (surplus > 0 && isAccumulative && exp.wallet_id) {
      walletMovements.push({
        wallet_id: exp.wallet_id,
        amount: surplus,
        type: "accumulative",
        description: `Sobrante en ${cat.name}: €${surplus.toFixed(2)}`,
      })
    }
  }

  // --- Distribución del bote mensual
  // Primero cantidades fijas, luego porcentajes sobre remanente
  let remainingPot = monthlyPot
  const sortedRules = [...distributionRules].sort((a, b) => a.priority - b.priority)
  for (const rule of sortedRules.filter(r => r.type === "fixed")) {
    const amt = Math.min(Number(rule.value), remainingPot)
    walletMovements.push({
      wallet_id: rule.wallet_id,
      amount: amt,
      type: "accumulative",
      description: `Bote mensual (fijo): €${amt.toFixed(2)}`,
    })
    remainingPot -= amt
  }
  const percentageRules = sortedRules.filter(r => r.type === "percentage")
  const percTotal = percentageRules.reduce((s, r) => s + Number(r.value), 0)
  if (remainingPot > 0 && percTotal > 0) {
    for (const rule of percentageRules) {
      const amt = (remainingPot * Number(rule.value)) / percTotal
      walletMovements.push({
        wallet_id: rule.wallet_id,
        amount: amt,
        type: "accumulative",
        description: `Bote mensual (%): €${amt.toFixed(2)}`,
      })
    }
  }

  // --- Insertar movimientos de monedero y actualizar saldo
  for (const wallet of wallets) {
    // Movimientos de este monedero
    const movements = walletMovements.filter(m => m.wallet_id === wallet.id)
    if (movements.length === 0) continue
    const totalChange = movements.reduce((s, m) => s + m.amount, 0)

    // Insertar movimientos en wallet_transactions
    for (const m of movements) {
      await supabase.from("wallet_transactions").insert([{
        user_id: userId,
        wallet_id: wallet.id,
        monthly_ingestion_id: monthlyIngestionId,
        amount: m.amount,
        description: m.description,
        created_at: new Date().toISOString(),
      }])
    }

    // Actualizar saldo del monedero
    await supabase.from("wallets").update({
      current_balance: Number(wallet.current_balance) + totalChange,
      updated_at: new Date().toISOString(),
    }).eq("id", wallet.id)
  }

  // --- Insertar ingresos en asset_transactions y actualizar saldo de bienes
  for (const asset of assets) {
    const assetIncomes = incomes.filter(i => i.asset_id === asset.id)
    const totalIncome = assetIncomes.reduce((s, i) => s + Number(i.amount), 0)
    if (totalIncome > 0) {
      await supabase.from("asset_transactions").insert([{
        user_id: userId,
        asset_id: asset.id,
        monthly_ingestion_id: monthlyIngestionId,
        amount: totalIncome,
        description: `Ingresos del mes`,
        created_at: new Date().toISOString(),
      }])
      // Actualizar saldo del bien
      await supabase.from("assets").update({
        current_balance: Number(asset.current_balance) + totalIncome,
        updated_at: new Date().toISOString(),
      }).eq("id", asset.id)
    }
  }

  return { ok: true }
}
