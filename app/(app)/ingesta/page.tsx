"use client" // Indica que este componente es un "Client Component" en Next.js (necesario para usar hooks, estado, efectos, etc.)

// Imports de React y hooks
import { useState, useEffect, useCallback } from "react"

// Imports de componentes UI reutilizables de tu sistema de diseño (basados en shadcn/ui + Tailwind)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Iconos de lucide-react para mejorar la UX visual y semántica
import { Plus, Trash2, AlertTriangle, Save, TrendingUp, Settings, Percent, DollarSign } from "lucide-react"

// Hook de Next.js para navegación programática entre páginas (router.push)
import { useRouter } from "next/navigation"
import { getCategories } from "@/services/categoryService"
import { Asset, CategoryExpense, DistributionRule, EnrichedCategory, Income, Wallet, WalletTransaction, WalletTransactionType } from "@/types/models"
import { fetchWallets, updateWallet } from "@/services/walletService"
import { fetchAssets, updateAsset } from "@/services/assetService"
import { useRequireAuth } from "@/hooks/useRequireAuth"
import { getMonthlyIngestion, saveMonthlyIngestion } from "@/services/ingestionService"
import { fetchDistributionRules } from "@/services/distributionRulesService"
import { createWalletTransaction } from "@/services/walletTransactionService"
import { createAssetTransaction } from "@/services/assetTransactionService"

// ===========================
//    TIPOS Y MODELOS DE DATOS
// ===========================

// Representa una categoría de gasto según el modelo YNAB extendido
interface Category {
  id: string // Identificador único
  name: string // Nombre descriptivo
  type: "gasto" | "gasto_acumulativo" | "gasto_mixto" | "gasto_acumulativo_opcional" // Tipo según reglas YNAB mejoradas
  monthlyBudget: number // Presupuesto mensual asignado
  active: boolean // Si está activa (no borrada ni archivada)
  walletId?: string // Opcional: monedero asociado (sólo para acumulativas o mixtas)
}

type DraftWalletTransaction = {
  wallet_id: string
  user_id: string
  monthly_ingestion_id: string | null
  amount: number
  wallet_transaction_type_id: number // Debe venir del mapping de tipos (exceso, sobrante...)
  description: string | null
}

// Representa un bien o activo: cuenta bancaria, efectivo, inversión, etc.
// interface Asset {
//   id: string
//   name: string
//   type: string
//   currentBalance: number // Saldo actual
// }

// Ingreso puntual en el mes, asociado a un bien/activo
// interface Income {
//   id: string
//   amount: number
//   assetId: string // Debe estar asociado a un bien si amount > 0 (regla crítica)
//   description?: string
// }

// Gasto registrado para una categoría (puede incluir walletId si se compensa desde un monedero)
// interface CategoryExpense {
//   categoryId: string
//   amount: number
//   walletId?: string // De dónde sale el dinero en excesos o sobrantes acumulativos
// }

// Movimiento de monedero para reflejar impactos en saldo (excesos, sobrantes, etc.)
interface WalletMovement {
  walletId: string
  amount: number // Positivo (entra dinero), negativo (sale dinero)
  type: "excess" | "surplus" | "accumulative" // Tipo de movimiento según lógica de YNAB
  description: string // Para mostrar en UI
}

// Monedero/fondo para objetivos o acumulación de dinero
// interface Wallet {
//   id: string
//   name: string
//   currentBalance: number
//   targetBalance?: number // Objetivo (opcional)
// }

// // Regla avanzada para distribución del bote mensual (porcentaje o cantidad fija)
// interface DistributionRule {
//   walletId: string
//   type: "percentage" | "fixed" // Dos tipos: porcentaje sobre el resto, o cantidad fija
//   value: number // Valor porcentual o cantidad fija en euros
//   priority: number // Orden de prioridad de aplicación (1 = primero)
// }

// ===========================
//        COMPONENTE PRINCIPAL
// ===========================

export default function IngestaPage() {
  const session = useRequireAuth()
  if (!session) return null
  
  const router = useRouter() // Para navegar entre páginas tras guardar, etc.

  // ============
  // ESTADO LOCAL
  // ============

  // Mes y año seleccionados (por defecto: mes y año actual)
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [year, setYear] = useState<number>(new Date().getFullYear())

  // Listados de datos principales cargados desde localStorage/configuración inicial
  const [categories, setCategories] = useState<EnrichedCategory[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [assets, setAssets] = useState<Asset[]>([])

  // Datos editables específicos de la ingesta de este mes
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [distributionRules, setDistributionRules] = useState<DistributionRule[]>([])

  // Estados auxiliares de la UI
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false) // Si está abierta la modal de reglas de distribución
  const [errors, setErrors] = useState<{ [key: string]: string }>({}) // Para feedback y validaciones

  
  // ======================
  // PERSISTENCIA TEMPORAL
  // ======================
  // Estos useEffect garantizan que los datos de la ingesta NO se pierdan si el usuario navega (UX amigable)

  useEffect(() => {
    // Cada vez que cambian los datos relevantes de la ingesta, se guardan temporalmente en localStorage
    const tempData = {
      month,
      year,
      categoryExpenses,
      incomes,
      distributionRules,
    }
    localStorage.setItem("tempIngestaData", JSON.stringify(tempData))
  }, [month, year, categoryExpenses, incomes, distributionRules])

  useEffect(() => {
    // Al cargar la página: si había datos temporales, los restauro (recuperación automática)
    const tempData = localStorage.getItem("tempIngestaData")
    if (tempData) {
      const parsed = JSON.parse(tempData)
      if (parsed.month && parsed.year) {
        setMonth(parsed.month)
        setYear(parsed.year)
      }
      if (parsed.categoryExpenses) {
        setCategoryExpenses(parsed.categoryExpenses)
      }
      if (parsed.incomes) {
        setIncomes(parsed.incomes)
      }
      if (parsed.distributionRules) {
        setDistributionRules(parsed.distributionRules)
      }
    }
  }, [])

  useEffect(() => {
    // Cuando cambian mes/año: recargo los datos base (categorías, monederos, activos y reglas)
    loadData()
  }, [month, year])

  useEffect(() => {
    // Revalido los datos cada vez que cambian entradas críticas: muestra errores de validación en tiempo real
    const validationErrors = getValidationErrors()
    setErrors(validationErrors)
  }, [month, year, categoryExpenses, incomes, categories, wallets, assets])

  // ===========================
  // FUNCIÓN PRINCIPAL DE CARGA
  // ===========================
  // Recupera categorías, monederos, bienes, reglas y si existe ya una ingesta previa para este mes/año
  // DOSUPABASE

  async function loadData() {
    // Cargo datos base desde localStorage --> DOSUPABASE
    // const savedCategories = localStorage.getItem("categories")
    const savedCategories = await getCategories() // Reemplaza con tu función de Supabase
    const savedWallets = await fetchWallets() // Reemplaza con tu función de Supabase
    const savedAssets = await fetchAssets(session!.user.id) // Reemplaza con tu función de Supabase
    const savedDistributionRules = await fetchDistributionRules(session!.user.id)

    if (savedCategories && savedCategories.length > 0) {
      // const cats = JSON.parse(savedCategories)
      // Sólo categorías activas (no archivadas)
      const activeCategories = savedCategories.filter((cat: EnrichedCategory) => cat.active)
      setCategories(activeCategories)

      // Inicializo gastos de cada categoría para el mes actual (para tener una fila de gasto por cada categoría)
      const initialExpenses: CategoryExpense[] = activeCategories.map((cat: EnrichedCategory) => ({
        id: '', // TODO: O puedes omitirlo si no lo usas aún (al crear la ingesta, Supabase lo puede autogenerar)
        user_id: '', // TODO: <- deberías obtener el user_id de la sesión actual
        monthly_ingestion_id: '', // <- igual, lo sabrás cuando se cree la ingesta del mes
        category_id: cat.id,
        amount: 0,
        wallet_id: cat.wallet_id,
        created_at: '', // Puedes omitirlo, lo genera Supabase automáticamente
      }))
      setCategoryExpenses(initialExpenses)
    }

    if (savedWallets && savedWallets.length > 0) {
      setWallets(savedWallets)
    }
    if (savedAssets && savedAssets.length > 0) {
      setAssets(savedAssets)
    }

    // Cargo reglas de distribución del bote (si existen)
    if (savedDistributionRules) {
      setDistributionRules(savedDistributionRules)
    } else {
      // Si no hay reglas guardadas, creo una regla por monedero con porcentaje igualitario
      const walletsData = savedWallets ? savedWallets : []
      // Supón que walletsData es un array de monederos, ya obtenido de Supabase
      const defaultRules: DistributionRule[] = walletsData.map((wallet, index) => ({
        id: '', // Supabase lo generará después
        user_id: '', // Lo añadirás cuando guardes
        wallet_id: wallet.id,
        type: "percentage",
        value: walletsData.length > 0 ? Math.floor(100 / walletsData.length) : 0,
        priority: index + 1,
        created_at: '', // Supabase lo pondrá luego
        updated_at: '',
      }))
      setDistributionRules(defaultRules)
    }

    // Compruebo si ya existe ingesta previa para este mes/año (regla crítica YNAB)
    // const savedIngestions = localStorage.getItem("monthlyIngestions")
    // if (savedIngestions) {
    //   const ingestions = JSON.parse(savedIngestions)
    //   const existing = ingestions.find((ing: any) => ing.month === month && ing.year === year)
    //   if (existing) {
    //     setIncomes(existing.incomes || [])
    //     if (existing.categoryExpenses) {
    //       setCategoryExpenses(existing.categoryExpenses)
    //     }
    //   } else {
    //     // Si no hay, limpio ingresos para empezar de cero
    //     setIncomes([])
    //   }
    // }
    const savedIngestions = await getMonthlyIngestion(year, month)
    if (savedIngestions) {
      // Cargar los ingresos del mes (tabla incomes)
      setIncomes(savedIngestions.incomes || [])
      // Cargar los gastos de categoría del mes (tabla category_expenses)
      setCategoryExpenses(savedIngestions.expenses || [])
    } else {
      // Si no hay ingesta para ese mes/año, inicializa vacío para empezar de cero
      setIncomes([])
    }
  }

  // ========================
  // CRUD DE INGRESOS DEL MES
  // ========================

  const addIncome = () => {
    // Validación: no permitir varios ingresos incompletos (sin bien asociado si amount > 0)
    const incompleteIncomes = incomes.filter((income) => income.amount > 0 && !income.asset_id)
    if (incompleteIncomes.length > 0) {
      setErrors((prev) => ({
        ...prev,
        incomes:
          "Completa todos los ingresos antes de agregar uno nuevo. Asigna un bien a cada ingreso con cantidad mayor a 0.",
      }))
      return
    }

    // Crea nuevo ingreso con campos vacíos (cantidad 0, assetId vacío)
    const newIncome: Income = {
      id: Date.now().toString(),
      user_id: session!.user.id,
      monthly_ingestion_id: "",
      amount: 0,
      asset_id: "",
      description: "",
      created_at: new Date().toISOString(),
    }
    setIncomes([...incomes, newIncome])
    setErrors((prev) => ({ ...prev, incomes: "" }))
  }

  // Actualiza un campo concreto de un ingreso (id único, campo a modificar, valor)
  const updateIncome = (id: string, field: keyof Income, value: any) => {
    setIncomes(incomes.map((income) => (income.id === id ? { ...income, [field]: value } : income)))
    setErrors((prev) => ({ ...prev, incomes: "" })) // Limpia errores al editar
  }

  // Elimina un ingreso por id
  const removeIncome = (id: string) => {
    setIncomes(incomes.filter((income) => income.id !== id))
    setErrors((prev) => ({ ...prev, incomes: "" }))
  }

  // ========================
  // CRUD DE GASTOS POR CATEGORÍA
  // ========================

  // Actualiza un campo concreto de un gasto por categoría
  // const updateCategoryExpense = (categoryId: string, field: keyof CategoryExpense, value: any) => {
  //   setCategoryExpenses((prev) =>
  //     prev.map((expense) => (expense.category_id === categoryId ? { ...expense, [field]: value } : expense)),
  //   )
  // }
  const updateCategoryExpense = (categoryId: string, field: keyof CategoryExpense, value: any) => {
    setCategoryExpenses(prev => {
      const idx = prev.findIndex(e => e.category_id === categoryId);
      if (idx === -1) {
        // crear registro nuevo si no existe
        const cat = categories.find(c => c.id === categoryId);
        const newRow: CategoryExpense = {
          id: '',
          user_id: session!.user.id,
          monthly_ingestion_id: '',
          category_id: categoryId,
          amount: field === 'amount' ? value : 0,
          wallet_id: field === 'wallet_id' ? value : (cat?.wallet_id ?? ''),
          created_at: '',
        };
        return [...prev, newRow];
      }
      // actualizar existente
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };
  
  // ========================
  // CRUD DE REGLAS DE DISTRIBUCIÓN
  // ========================

  // Actualiza una regla de distribución concreta (walletId es el id único de la regla)
  const updateDistributionRule = (walletId: string, field: keyof DistributionRule, value: any) => {
    setDistributionRules((prev) =>
      prev.map((rule) => (rule.wallet_id === walletId ? { ...rule, [field]: value } : rule)),
    )
  }

  // Guarda las reglas de distribución en localStorage y cierra el diálogo
  const saveDistributionRules = () => {
    localStorage.setItem("distributionRules", JSON.stringify(distributionRules))
    setIsDistributionDialogOpen(false)
  }

  // ==========================
  // HELPERS DE CATEGORÍAS/GASTOS
  // ==========================

  // Obtiene el gasto registrado para una categoría concreta
  const getCategoryExpense = (categoryId: string) => {
    return categoryExpenses.find((exp) => exp.category_id === categoryId)
  }

  // Calcula el exceso de gasto sobre presupuesto de una categoría concreta
  const getCategoryExcess = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    const expense = getCategoryExpense(categoryId)
    if (!category || !expense) return 0
    return Math.max(0, expense.amount - category.monthly_budget)
  }

  // Calcula el sobrante (lo que no se ha gastado del presupuesto) en una categoría
  const getCategorySurplus = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    const expense = getCategoryExpense(categoryId)
    if (!category || !expense) return 0
    return Math.max(0, category.monthly_budget - expense.amount)
  }

  // Determina si una categoría es de tipo acumulativo (incluyendo mixtas y opcionales)
  const isAccumulativeCategory = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    return (
      category &&
      (category.category_types?.name === "gasto_acumulativo" ||
        category.category_types?.name === "gasto_mixto" ||
        category.category_types?.name === "gasto_acumulativo_opcional")
    )
  }

  // ==========================
  // CÁLCULO DE MOVIMIENTOS DE MONEDERO
  // ==========================
  // Devuelve todos los movimientos de monedero derivados de la ingesta actual

  const calculateWalletMovements = (): WalletMovement[] => {
    const movements: WalletMovement[] = []

    categoryExpenses.forEach((expense) => {
      const category = categories.find((cat) => cat.id === expense.category_id)
      if (!category) return

      const excess = getCategoryExcess(expense.category_id)
      const surplus = getCategorySurplus(expense.category_id)

      // EXCESO: Si hay exceso y tiene walletId (es decir, se cubre desde monedero, NO desde bote mensual)
      if (excess > 0 && expense.wallet_id) {
        movements.push({
          walletId: expense.wallet_id,
          amount: -excess, // Sale dinero del monedero
          type: "excess",
          description: `Exceso en ${category.name}: €${excess.toFixed(2)}`,
        })
      }

      // SOBRANTE: Si hay sobrante en acumulativas, y hay walletId (entra en el monedero)
      if (surplus > 0 && isAccumulativeCategory(expense.category_id) && expense.wallet_id) {
        movements.push({
          walletId: expense.wallet_id,
          amount: surplus, // Entra dinero al monedero
          type: "accumulative",
          description: `Sobrante de ${category.name}: €${surplus.toFixed(2)}`,
        })
      }
    })

    return movements
  }

  // ==========================
  // CÁLCULO DE TOTALES GENERALES DEL MES
  // ==========================
  // Calcula: presupuesto total, gastado, ingresos, bote mensual, excesos cubiertos por monederos

  const calculateTotals = () => {
    const totalBudget = categories.reduce((sum, cat) => sum + cat.monthly_budget, 0)
    const totalSpent = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0)

    // Calcular excesos que se cubren desde monederos
    let excessesCoveredByWallets = 0

    categoryExpenses.forEach((expense) => {
      const category = categories.find((cat) => cat.id === expense.category_id)
      if (category && expense.wallet_id) {
        const excess = Math.max(0, expense.amount - category.monthly_budget)
        if (excess > 0) {
          excessesCoveredByWallets += excess
        }
      }
    })

    // Bote mensual: ingresos - gastos + excesos cubiertos por monederos (regla fundamental YNAB)
    const monthlyPot = totalIncome - totalSpent + excessesCoveredByWallets //TOREVIEW: Los excesos son negativos? Si son positivos, hay que restarlos

    return { totalBudget, totalSpent, totalIncome, monthlyPot, excessesCoveredByWallets }
  }

  // ==========================
  // CÁLCULO DE DISTRIBUCIÓN DEL BOTE SEGÚN REGLAS AVANZADAS
  // ==========================
  // Aplica primero cantidades fijas por prioridad, luego porcentajes sobre el remanente
  // Devuelve objeto { walletId: cantidad }

  const calculateDistributionFromRules = (monthlyPot: number) => {
    // Ordena reglas por prioridad (menor primero)
    const sortedRules = [...distributionRules].sort((a, b) => a.priority - b.priority)
    const distribution: { [walletId: string]: number } = {}
    let remainingAmount = monthlyPot

    // 1. Aplicar cantidades fijas
    sortedRules
      .filter((rule) => rule.type === "fixed")
      .forEach((rule) => {
        const assignedAmount = Math.min(rule.value, remainingAmount)
        distribution[rule.wallet_id] = assignedAmount
        remainingAmount -= assignedAmount
      })

    // 2. Aplicar porcentajes sobre el remanente
    const percentageRules = sortedRules.filter((rule) => rule.type === "percentage")
    const totalPercentage = percentageRules.reduce((sum, rule) => sum + rule.value, 0)

    if (totalPercentage > 0 && remainingAmount > 0) {
      percentageRules.forEach((rule) => {
        const assignedAmount = (remainingAmount * rule.value) / totalPercentage
        distribution[rule.wallet_id] = (distribution[rule.wallet_id] || 0) + assignedAmount
      })
    }

    return distribution
  }

  // ==========================
  // RESUMEN DE MOVIMIENTOS POR MONEDERO
  // ==========================
  // Devuelve objeto { walletId: sumaMovimientos }

  const getWalletMovementsSummary = () => {
    const movements = calculateWalletMovements()
    const summary: { [walletId: string]: number } = {}

    movements.forEach((movement) => {
      if (!summary[movement.walletId]) {
        summary[movement.walletId] = 0
      }
      summary[movement.walletId] += movement.amount
    })

    return summary
  }

  // ==========================
  // COMPROBAR SI YA EXISTE INGESTA PARA ESTE MES/AÑO
  // ==========================
  // Devuelve true/false (regla crítica para no duplicar ingestas)

  const checkIfMonthExists = useCallback(() => {
    const savedIngestions = localStorage.getItem("monthlyIngestions")
    if (!savedIngestions) return false

    const ingestions = JSON.parse(savedIngestions)
    return ingestions.some((ing: any) => ing.month === month && ing.year === year)
  }, [month, year])

  // ==========================
  // COMPROBAR SI EL BOTE MENSUAL PUEDE CUBRIR UN EXCESO
  // ==========================
  // Función avanzada de validación: ayuda en UI para saber si el exceso puede cubrirse por el bote mensual

  const canPotCoverExcess = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    const expense = getCategoryExpense(categoryId)
    if (!category || !expense) return false

    const excess = Math.max(0, expense.amount - category.monthly_budget)
    if (excess === 0) return false

    // Cálculo del bote sin este exceso, sumando otros excesos cubiertos por monedero/bote
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0)
    const totalSpent = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0)

    // Otros excesos cubiertos por monederos o bote (excluyendo el actual)
    let otherExcessesCoveredByWallets = 0
    let otherExcessesCoveredByPot = 0

    categoryExpenses.forEach((exp) => {
      if (exp.category_id === categoryId) return // Excluir el actual

      const cat = categories.find((c) => c.id === exp.category_id)
      if (cat) {
        const otherExcess = Math.max(0, exp.amount - cat.monthly_budget)
        if (otherExcess > 0) {
          if (exp.wallet_id === "monthly-pot") {
            otherExcessesCoveredByPot += otherExcess
          } else if (exp.wallet_id) {
            otherExcessesCoveredByWallets += otherExcess
          }
        }
      }
    })

    const preliminaryPot = totalIncome - totalSpent + otherExcessesCoveredByWallets - otherExcessesCoveredByPot
    return preliminaryPot >= excess
  }

  // ==========================
  // VALIDACIONES CRÍTICAS DE INGESTA
  // ==========================
  // Devuelve objeto { campo: error } con todos los posibles errores de validación

  const getValidationErrors = () => {
    const newErrors: { [key: string]: string } = {}

    // 1. No duplicar meses
    if (checkIfMonthExists()) {
      newErrors.month = `Ya existe una ingesta para ${month}/${year}. No se puede duplicar.`
    }

    // 2. Categorías acumulativas con gasto DEBEN tener monedero asignado
    for (const expense of categoryExpenses) {
      if (expense.amount > 0 && isAccumulativeCategory(expense.category_id) && !expense.wallet_id) {
        newErrors.categories = "Las categorías acumulativas con gasto deben tener un monedero asignado"
        break
      }
    }

    // 3. Ingresos con cantidad > 0 DEBEN tener bien asociado
    for (const income of incomes) {
      if (income.amount > 0 && !income.asset_id) {
        newErrors.incomes = "Todos los ingresos con cantidad deben tener un bien asociado"
        break
      }
    }

    // 4. Distribución de porcentajes debe sumar exactamente 100%
    const activeRules = distributionRules.filter((rule) => rule.value > 0)
    if (activeRules.length > 0) {
      const totalPercentage = activeRules
        .filter((rule) => rule.type === "percentage")
        .reduce((sum, rule) => sum + rule.value, 0)

      if (Math.abs(totalPercentage - 100) > 0.01) {
        newErrors.distribution = `La distribución debe sumar 100%. Actualmente suma ${totalPercentage.toFixed(1)}%`
      }
    }

    return newErrors
  }

  // ==========================
  // GUARDAR INGESTA COMPLETA
  // ==========================
  // 1. Valida
  // 2. Convierte a formato legacy (compatibilidad con exportación/importación)
  // 3. Guarda en localStorage
  // 4. Actualiza saldos de monederos y bienes
  // 5. Limpia persistencia temporal
  // 6. Dispara evento global y navega

  const saveIngestion = async () => {
    const validationErrors = getValidationErrors()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    try {
      // Adaptación a formato legacy de ingestas para compatibilidad
      const expenses: { [categoryId: string]: number } = {}
      const walletAdjustments: { [categoryId: string]: string } = {}

      categoryExpenses.forEach((expense) => {
        expenses[expense.category_id] = expense.amount
        if (expense.wallet_id) {
          walletAdjustments[expense.category_id] = expense.wallet_id
        }
      })
      
      // Guarda la ingesta en Supabase
      const { data, error } = await saveMonthlyIngestion({
        user_id: session!.user.id,
        month,
        year,
      })

      if (error) {
        console.error('Error saving ingestion:', error)
        alert(`Error al guardar la ingesta: ${error}`)
        return
      }

      if (!data) {
        console.error('No data returned from saveMonthlyIngestion')
        alert('Error: No se recibieron datos al guardar la ingesta')
        return
      }

      // Estructura completa de la ingesta mensual con el ID devuelto por Supabase
      const ingestionData = {
        id: data.id, // ID devuelto por Supabase
        user_id: session!.user.id,
        month,
        year,
        date: `${year}-${String(month).padStart(2, "0")}-01`,
      }

      // Ahora guarda los ingresos y gastos asociados a esta ingesta
      // await saveIncomesAndExpenses(data.id)

      // Actualiza saldos de monederos y bienes (según lógica YNAB)
      await updateBalances(ingestionData)

      // Limpia datos temporales (ya no es necesario)
      localStorage.removeItem("tempIngestaData")

      // Dispara evento global para que otras pantallas se refresquen
      window.dispatchEvent(new CustomEvent("ingestaCompleted"))

      alert("Ingesta guardada correctamente")
      router.push("/") // Vuelve a la pantalla principal
    } catch (error) {
      console.error('Error in saveIngestion:', error)
      alert(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  // ==========================
  // ACTUALIZAR SALDOS DE MONEDEROS Y BIENES AL GUARDAR INGESTA
  // ==========================
  // Aplica todos los movimientos calculados, así como la distribución del bote, y suma ingresos a activos
  /**
   * Actualiza los saldos de monederos y bienes tras una ingesta mensual y registra los movimientos.
   * @param ingestionData - Objeto con los datos de la ingesta (debería incluir user_id, id de ingesta, etc.)
   */
  const updateBalances = async (ingestionData: {
    user_id: string
    id?: string // id de la ingesta, si ya lo tienes disponible (importante para trazabilidad)
    month: number
    year: number
    date: string
  }) => {
    const movements = calculateWalletMovements()
    const totals = calculateTotals()
    const distribution = calculateDistributionFromRules(totals.monthlyPot)

    // Agrupa los cambios netos por monedero (excesos, sobrantes, distribución)
    const walletBalanceChanges: { [walletId: string]: number } = {}

    // 1. Suma movimientos (excesos/sobrantes)
    movements.forEach((movement) => {
      if (!walletBalanceChanges[movement.walletId]) {
        walletBalanceChanges[movement.walletId] = 0
      }
      walletBalanceChanges[movement.walletId] += movement.amount
    })

    // 2. Añade la parte de la distribución del bote
    Object.entries(distribution).forEach(([walletId, amount]) => {
      if (!walletBalanceChanges[walletId]) {
        walletBalanceChanges[walletId] = 0
      }
      walletBalanceChanges[walletId] += amount
    })

    // 3. Actualiza monederos y registra movimientos
    await Promise.all(
      wallets.map(async (wallet) => {
        const change = walletBalanceChanges[wallet.id] || 0
        if (change !== 0) {
          // 3.1 Actualiza saldo del monedero en Supabase
          await updateWallet(wallet.id, {
            current_balance: wallet.current_balance + change,
          })

          // 3.2 Registra los movimientos individuales (exceso/sobrante/distribución)
          // Primero los movimientos por exceso/sobrante
          movements
            .filter((m) => m.walletId === wallet.id)
            .forEach(async (m) => {
              // Ajusta el tipo según tu mapping real en la tabla
              let wallet_transaction_type_id = 1 // Por ejemplo: 1 = exceso, 2 = sobrante/acumulativo
              if (m.type === "excess") wallet_transaction_type_id = 1
              if (m.type === "accumulative") wallet_transaction_type_id = 2

              await createWalletTransaction({
                user_id: ingestionData.user_id,
                wallet_id: wallet.id,
                monthly_ingestion_id: ingestionData.id || null,
                amount: m.amount,
                wallet_transaction_type_id,
                description: m.description,
              })
            })

          // Luego el movimiento por distribución del bote, si existe
          const distAmount = distribution[wallet.id] || 0
          if (distAmount !== 0) {
            // Usa un tipo específico para "aporte del bote mensual", ej. 3
            await createWalletTransaction({
              user_id: ingestionData.user_id,
              wallet_id: wallet.id,
              monthly_ingestion_id: ingestionData.id || null,
              amount: distAmount,
              wallet_transaction_type_id: 3, // Ajusta según tus tipos TODO: Pillar los tipos de la base de datos (no se si lo necesito)
              description: "Aporte del bote mensual",
            })
          }
        }
      })
    )

    // 4. Actualiza bienes (assets) y registra movimientos
    await Promise.all(
      assets.map(async (asset) => {
        // Busca ingresos del mes para este bien
        const assetIncomes = incomes.filter((income) => income.asset_id === asset.id)
        const totalIncome = assetIncomes.reduce((sum, income) => sum + income.amount, 0)
        if (totalIncome !== 0) {
          // 4.1 Actualiza saldo del bien en Supabase
          await updateAsset(asset.id, {
            current_balance: asset.current_balance + totalIncome,
          })

          // 4.2 Registra los movimientos individuales (uno por ingreso)
          for (const income of assetIncomes) {
            await createAssetTransaction({
              user_id: ingestionData.user_id,
              asset_id: asset.id,
              monthly_ingestion_id: ingestionData.id || null,
              amount: income.amount,
              asset_transaction_type_id: 1, // Ejemplo: 1 = ingreso, ajusta según tus tipos reales
              description: income.description || "Ingreso mensual",
            })
          }
        }
      })
    )
  }



  // const updateBalances = (ingestionData: any) => {
  //   const movements = calculateWalletMovements()
  //   const totals = calculateTotals()
  //   const distribution = calculateDistributionFromRules(totals.monthlyPot)

  //   // 1. Actualizar monederos: aplicar movimientos y distribución del bote
  //   const updatedWallets = wallets.map((wallet) => {
  //     let balanceChange = 0

  //     // Movimientos específicos de categorías (excesos/sobrantes)
  //     movements.forEach((movement) => {
  //       if (movement.walletId === wallet.id) {
  //         balanceChange += movement.amount
  //       }
  //     })

  //     // Sumar la parte del bote que le toca por distribución
  //     const distributionAmount = distribution[wallet.id] || 0
  //     balanceChange += distributionAmount

  //     return {
  //       ...wallet,
  //       currentBalance: wallet.current_balance + balanceChange,
  //     }
  //   })

  //   // 2. Actualizar bienes (assets): sumar ingresos del mes
  //   const updatedAssets = assets.map((asset) => {
  //     const assetIncomes = incomes.filter((income) => income.assetId === asset.id)
  //     const totalIncome = assetIncomes.reduce((sum, income) => sum + income.amount, 0)

  //     return {
  //       ...asset,
  //       currentBalance: asset.current_balance + totalIncome,
  //     }
  //   })

  //   // Guarda los nuevos saldos
  //   localStorage.setItem("wallets", JSON.stringify(updatedWallets)) //SUPABASE
  //   localStorage.setItem("assets", JSON.stringify(updatedAssets)) //SUPABASE
  // }

  // ==========================
  // CÁLCULOS AUXILIARES PARA MOSTRAR EN UI
  // ==========================

  const totals = calculateTotals()
  const walletMovements = calculateWalletMovements()
  const walletSummary = getWalletMovementsSummary()
  const monthlyPotDistribution = calculateDistributionFromRules(totals.monthlyPot)

  // ==========================
  // RENDER DE LA INTERFAZ
  // ==========================
  // ¡Esta parte se apoya intensamente en el sistema de componentes shadcn/ui!
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Encabezado de la pantalla */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ingesta Mensual</h1>
          <p className="text-muted-foreground">Introduce los datos del mes</p>
        </div>
        {/* Botón de guardar ingesta, sólo habilitado si no hay errores */}
        <Button onClick={saveIngestion} disabled={Object.keys(errors).length > 0}>
          <Save className="mr-2 h-4 w-4" />
          Guardar Ingesta
        </Button>
      </div>

      {/* Mensaje de errores generales en forma de alerta visual */}
      {Object.keys(errors).length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {Object.values(errors).map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* --- SECCIÓN: Selección de mes y año --- */}
      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          {/* Selector de mes (1 a 12, nombre del mes en español) */}
          <div className="space-y-2">
            <Label>Mes</Label>
            <Select value={month.toString()} onValueChange={(value) => setMonth(Number.parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {new Date(0, i).toLocaleString("es", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Selector de año (input numérico) */}
          <div className="space-y-2">
            <Label>Año</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number.parseInt(e.target.value))}
              className="w-24"
            />
          </div>
          {/* Mensaje si ya existe ingesta para ese mes */}
          {checkIfMonthExists() && (
            <div className="flex items-center">
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  Ya existe una ingesta para este mes. No se puede duplicar.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- SECCIÓN: Gastos por Categoría --- */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos por Categoría</CardTitle>
          <CardDescription>Introduce el gasto realizado en cada categoría</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recorre todas las categorías activas */}
          {categories.map((category) => {
            const expense = getCategoryExpense(category.id)
            const spent = expense?.amount || 0
            const excess = getCategoryExcess(category.id)
            const surplus = getCategorySurplus(category.id)
            const percentage = category.monthly_budget > 0 ? (spent / category.monthly_budget) * 100 : 0
            const isAccumulative = isAccumulativeCategory(category.id)

            return (
              <div key={category.id} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  {/* Nombre, tipo y si requiere monedero */}
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{category.name}</span>
                    <Badge variant="outline">{category.category_types!.name.replace("_", " ")}</Badge>
                    {isAccumulative && <Badge variant="secondary">Requiere Monedero</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">Presupuesto: €{category.monthly_budget.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Input de gasto realizado */}
                  <div>
                    <Label>Gasto realizado</Label>
                    <Input
                      type="text"
                      value={spent === 0 ? "" : spent.toString()}
                      onChange={(e) => {
                        const inputValue = e.target.value
                        if (inputValue === "") {
                          updateCategoryExpense(category.id, "amount", 0)
                        } else {
                          const numericValue = parseFloat(inputValue)
                          if (!isNaN(numericValue) && numericValue >= 0) {
                            updateCategoryExpense(category.id, "amount", numericValue)
                          }
                        }
                      }}
                      placeholder="0.00"
                    />
                  </div>

                  {/* Selector de monedero (si aplica por lógica YNAB) */}
                  {(isAccumulative || excess > 0) && (
                    <div>
                      <Label>{isAccumulative ? "Monedero (obligatorio)" : "Cobertura del exceso (opcional)"}</Label>
                      <Select
                        value={expense?.wallet_id || ""}
                        onValueChange={(value) =>
                          updateCategoryExpense(category.id, "wallet_id", value === "none" ? "" : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={isAccumulative ? "Seleccionar monedero" : "Bote mensual (por defecto)"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Si NO es acumulativa, se puede elegir "Bote mensual" (sin monedero concreto) */}
                          {!isAccumulative && (
                            <SelectItem value="none">
                              <div className="flex items-center">
                                <TrendingUp className="mr-2 h-4 w-4 text-blue-600" />
                                Bote mensual (por defecto)
                              </div>
                            </SelectItem>
                          )}
                          {/* Lista de monederos disponibles */}
                          {wallets.map((wallet) => (
                            <SelectItem key={wallet.id} value={wallet.id}>
                              {wallet.name} (€{wallet.current_balance.toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Barra de progreso y porcentaje sobre presupuesto */}
                  <div className="flex flex-col justify-end">
                    <Progress value={Math.min(percentage, 100)} className="mb-2" />
                    <div className="text-xs text-center">{percentage.toFixed(1)}% del presupuesto</div>
                  </div>
                </div>

                {/* Alerta visual de exceso de gasto */}
                {excess > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Exceso de €{excess.toFixed(2)}</strong>
                      {expense?.wallet_id
                        ? ` - Se descontará del monedero "${wallets.find((w) => w.id === expense.wallet_id)?.name}"`
                        : " - Se descontará del bote mensual"}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Alerta visual de sobrante acumulado */}
                {surplus > 0 && isAccumulative && (
                  <Alert className="border-green-200 bg-green-50">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Sobrante de €{surplus.toFixed(2)}</strong>
                      {expense?.wallet_id
                        ? ` - Se añadirá al monedero "${wallets.find((w) => w.id === expense.wallet_id)?.name}"`
                        : " - Selecciona un monedero para el sobrante"}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* --- SECCIÓN: Ingresos del mes --- */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos del Mes</CardTitle>
          <CardDescription>Registra todos los ingresos y su asignación a bienes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lista de ingresos */}
          {incomes.map((income) => (
            <div key={income.id} className="flex gap-4 items-end p-4 border rounded-lg">
              <div className="flex-1">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={income.amount}
                  onChange={(e) => updateIncome(income.id, "amount", Number.parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex-1">
                <Label>Bien asociado</Label>
                <Select value={income.asset_id} onValueChange={(value) => updateIncome(income.id, "asset_id", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar bien" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Descripción (opcional)</Label>
                <Input
                  value={income.description || ""}
                  onChange={(e) => updateIncome(income.id, "description", e.target.value)}
                  placeholder="Descripción del ingreso"
                />
              </div>
              {/* Botón para eliminar ingreso */}
              <Button variant="outline" size="icon" onClick={() => removeIncome(income.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Botón para añadir ingreso nuevo */}
          <div className="space-y-2">
            <Button onClick={addIncome} variant="outline" className="w-full bg-transparent">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Ingreso
            </Button>
            {/* Error específico de ingresos */}
            {errors.incomes && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{errors.incomes}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- SECCIÓN: Resumen de movimientos de monederos --- */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos de Monederos</CardTitle>
          <CardDescription>Resumen de lo que entra y sale de cada monedero</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {wallets.map((wallet) => {
              const movements = walletMovements.filter((m) => m.walletId === wallet.id)
              const totalMovement = walletSummary[wallet.id] || 0
              const monthlyPotShare = monthlyPotDistribution[wallet.id] || 0

              if (movements.length === 0 && monthlyPotShare === 0) return null

              return (
                <div key={wallet.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{wallet.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        Saldo actual: €{wallet.current_balance.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Listado de movimientos individuales */}
                  <div className="space-y-2">
                    {movements.map((movement, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span>{movement.description}</span>
                        <span className={movement.amount >= 0 ? "text-green-600" : "text-red-600"}>
                          {movement.amount >= 0 ? "+" : ""}€{movement.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {/* Aporte del bote mensual */}
                    {monthlyPotShare > 0 && (
                      <div className="flex justify-between items-center text-sm border-t pt-2">
                        <span>Bote mensual</span>
                        <span className="text-blue-600">+€{monthlyPotShare.toFixed(2)}</span>
                      </div>
                    )}

                    <Separator />
                    {/* Total neto de movimientos */}
                    <div className="flex justify-between items-center font-medium">
                      <span>Total cambio:</span>
                      <span className={totalMovement + monthlyPotShare >= 0 ? "text-green-600" : "text-red-600"}>
                        {totalMovement + monthlyPotShare >= 0 ? "+" : ""}€{(totalMovement + monthlyPotShare).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* --- SECCIÓN: Resumen del mes + Configuración de distribución --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Resumen del Mes
            {/* Botón para abrir el diálogo de configuración avanzada de reglas de distribución */}
            <Dialog open={isDistributionDialogOpen} onOpenChange={setIsDistributionDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurar Distribución
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Configurar Distribución del Bote Mensual</DialogTitle>
                  <DialogDescription>Modifica cómo se distribuye el bote mensual entre tus monederos</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {/* Lista editable de reglas, ordenada por prioridad */}
                  {distributionRules
                    .sort((a, b) => a.priority - b.priority)
                    .map((rule) => {
                      const wallet = wallets.find((w) => w.id === rule.wallet_id)
                      if (!wallet) return null

                      return (
                        <div key={rule.wallet_id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{wallet.name}</span>
                            <Badge variant="outline">Prioridad {rule.priority}</Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            {/* Selector de tipo de regla (porcentaje/cantidad fija) */}
                            <div>
                              <Label>Tipo</Label>
                              <Select
                                value={rule.type}
                                onValueChange={(value: "percentage" | "fixed") =>
                                  updateDistributionRule(rule.wallet_id, "type", value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentage">
                                    <div className="flex items-center">
                                      <Percent className="mr-2 h-4 w-4" />
                                      Porcentaje
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="fixed">
                                    <div className="flex items-center">
                                      <DollarSign className="mr-2 h-4 w-4" />
                                      Cantidad Fija
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Campo para valor: porcentaje o cantidad fija */}
                            <div>
                              <Label>{rule.type === "percentage" ? "Porcentaje (%)" : "Cantidad (€)"}</Label>
                              <Input
                                type="number"
                                min="0"
                                step={rule.type === "percentage" ? "1" : "0.01"}
                                max={rule.type === "percentage" ? "100" : undefined}
                                value={rule.value}
                                onChange={(e) =>
                                  updateDistributionRule(rule.wallet_id, "value", Number.parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </div>

                            {/* Campo de prioridad */}
                            <div>
                              <Label>Prioridad</Label>
                              <Input
                                type="number"
                                min="1"
                                value={rule.priority}
                                onChange={(e) =>
                                  updateDistributionRule(
                                    rule.wallet_id,
                                    "priority",
                                    Number.parseInt(e.target.value) || 1,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
                <DialogFooter>
                  <Button onClick={saveDistributionRules}>Guardar Configuración</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Cuatro KPIs principales del mes: presupuesto, gastado, ingresos, bote */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">€{totals.totalBudget.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Presupuesto</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">€{totals.totalSpent.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Gastado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">€{totals.totalIncome.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Ingresos</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${totals.monthlyPot >= 0 ? "text-green-600" : "text-red-600"}`}>
                €{totals.monthlyPot.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Bote Mensual</div>
            </div>
          </div>

          {/* Mensaje de excesos cubiertos por monederos (no reducen el bote) */}
          {totals.excessesCoveredByWallets > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Excesos cubiertos por monederos:</strong> €{totals.excessesCoveredByWallets.toFixed(2)} (no
                reducen el bote mensual)
              </div>
            </div>
          )}

          {/* Mensaje de excesos cubiertos por bote mensual */}
          {(() => {
            // Calcular excesos que se cubren desde el bote mensual
            const excessesToPot = categoryExpenses.reduce((sum, expense) => {
              const category = categories.find((cat) => cat.id === expense.category_id)
              if (category && !expense.wallet_id) {
                const excess = Math.max(0, expense.amount - category.monthly_budget)
                return sum + excess
              }
              return sum
            }, 0)

            return (
              excessesToPot > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="text-sm text-orange-800">
                    <strong>Excesos del bote mensual:</strong> €{excessesToPot.toFixed(2)} (ya descontados del bote)
                  </div>
                </div>
              )
            )
          })()}

          {/* Simulación visual de la distribución del bote mensual */}
          {totals.monthlyPot > 0 && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h4 className="font-medium mb-2 text-slate-900">Distribución del Bote Mensual:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(monthlyPotDistribution).map(([walletId, amount]) => {
                  const wallet = wallets.find((w) => w.id === walletId)
                  const percentage = totals.monthlyPot > 0 ? (amount / totals.monthlyPot) * 100 : 0
                  return (
                    <div key={walletId} className="flex justify-between text-slate-700">
                      <span>
                        {wallet?.name} ({percentage.toFixed(1)}%):
                      </span>
                      <span className="text-blue-600 font-medium">€{amount.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
