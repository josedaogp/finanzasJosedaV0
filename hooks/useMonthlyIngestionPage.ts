// /hooks/useMonthlyIngestionPage.ts
// ¿Qué hace este hook?
// Te da todos los datos y estados listos para la página.

// Puedes mutar los estados locales (setCategoryExpenses, setIncomes, etc.) como siempre.

// Si necesitas recargar datos después de guardar, llamas a reload().

// Si el mes / año cambian, recarga automáticamente.
    
import { useEffect, useState, useCallback } from "react"
import { loadMonthlyIngestionData } from "@/services/newIngestionService"
import { CategoryExpense, DistributionRule, Income, EnrichedCategory, Wallet, Asset, EnrichedMonthlyIngestion } from "@/types/models"
import { useSession } from "@supabase/auth-helpers-react"

type MonthlyIngestionPageState = {
  categories: EnrichedCategory[]
  wallets: Wallet[]
  assets: Asset[]
  distributionRules: DistributionRule[]
  monthlyIngestion?: EnrichedMonthlyIngestion
  categoryExpenses: CategoryExpense[]
  incomes: Income[]
  loading: boolean
  error?: string
  reload: () => Promise<void>
}

export function useMonthlyIngestionPage(month: number, year: number): MonthlyIngestionPageState {
  const session = useSession()
  const userId = session?.user.id

  const [categories, setCategories] = useState<EnrichedCategory[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [distributionRules, setDistributionRules] = useState<DistributionRule[]>([])
  const [monthlyIngestion, setMonthlyIngestion] = useState<EnrichedMonthlyIngestion | undefined>()
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>(undefined)

  // Función para recargar todo (útil tras guardar)
  const reload = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(undefined)
    try {
      const data = await loadMonthlyIngestionData(userId, month, year)
      setCategories(data.categories)
      setWallets(data.wallets)
      setAssets(data.assets)
      setDistributionRules(data.distributionRules)
      setMonthlyIngestion(data.monthlyIngestion)
      setCategoryExpenses(data.categoryExpenses)
      setIncomes(data.incomes)
      // Si no existe ingesta, inicializa los expenses para todas las categorías activas
      if (!data.monthlyIngestion) {
        setCategoryExpenses(data.categories.map((cat) => ({
          id: "", // nuevo, aún sin id
          user_id: userId,
          monthly_ingestion_id: "",
          category_id: cat.id,
          amount: 0,
          wallet_id: cat.wallet_id || null,
          created_at: "",
        })))
        setIncomes([])
      }
    } catch (e: any) {
      setError(e?.message || "Error cargando datos")
    } finally {
      setLoading(false)
    }
  }, [userId, month, year])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    categories,
    wallets,
    assets,
    distributionRules,
    monthlyIngestion,
    categoryExpenses,
    incomes,
    loading,
    error,
    reload,
  }
}
