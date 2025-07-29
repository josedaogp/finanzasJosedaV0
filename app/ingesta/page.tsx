"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Plus, Trash2, AlertTriangle, Save, TrendingUp, Settings, Percent, DollarSign } from "lucide-react"
import { useRouter } from "next/navigation"

interface Category {
  id: string
  name: string
  type: "gasto" | "gasto_acumulativo" | "gasto_mixto" | "gasto_acumulativo_opcional"
  monthlyBudget: number
  active: boolean
  walletId?: string
}

interface Asset {
  id: string
  name: string
  type: string
  currentBalance: number
}

interface Income {
  id: string
  amount: number
  assetId: string
  description?: string
}

interface CategoryExpense {
  categoryId: string
  amount: number
  walletId?: string
}

interface WalletMovement {
  walletId: string
  amount: number
  type: "excess" | "surplus" | "accumulative"
  description: string
}

interface Wallet {
  id: string
  name: string
  currentBalance: number
  targetBalance?: number
}

interface DistributionRule {
  walletId: string
  type: "percentage" | "fixed"
  value: number
  priority: number
}

export default function IngestaPage() {
  const router = useRouter()
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [categories, setCategories] = useState<Category[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [distributionRules, setDistributionRules] = useState<DistributionRule[]>([])
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Persistencia temporal de datos
  useEffect(() => {
    // Guardar datos temporales cuando cambien
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
    // Cargar datos temporales al iniciar
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
    loadData()
  }, [month, year])

  useEffect(() => {
    const validationErrors = getValidationErrors()
    setErrors(validationErrors)
  }, [month, year, categoryExpenses, incomes, categories, wallets, assets])

  const loadData = () => {
    // Cargar datos del localStorage
    const savedCategories = localStorage.getItem("categories")
    const savedWallets = localStorage.getItem("wallets")
    const savedAssets = localStorage.getItem("assets")
    const savedDistributionRules = localStorage.getItem("distributionRules")

    if (savedCategories) {
      const cats = JSON.parse(savedCategories)
      const activeCategories = cats.filter((cat: Category) => cat.active)
      setCategories(activeCategories)

      // Inicializar gastos por categoría
      const initialExpenses = activeCategories.map((cat: Category) => ({
        categoryId: cat.id,
        amount: 0,
        walletId: cat.walletId,
      }))
      setCategoryExpenses(initialExpenses)
    }

    if (savedWallets) {
      setWallets(JSON.parse(savedWallets))
    }
    if (savedAssets) {
      setAssets(JSON.parse(savedAssets))
    }

    // Cargar reglas de distribución
    if (savedDistributionRules) {
      setDistributionRules(JSON.parse(savedDistributionRules))
    } else {
      // Crear reglas por defecto
      const walletsData = savedWallets ? JSON.parse(savedWallets) : []
      const defaultRules: DistributionRule[] = walletsData.map((wallet: Wallet, index: number) => ({
        walletId: wallet.id,
        type: "percentage" as const,
        value: walletsData.length > 0 ? Math.floor(100 / walletsData.length) : 0,
        priority: index + 1,
      }))
      setDistributionRules(defaultRules)
    }

    // Verificar si ya existe ingesta para este mes
    const savedIngestions = localStorage.getItem("monthlyIngestions")
    if (savedIngestions) {
      const ingestions = JSON.parse(savedIngestions)
      const existing = ingestions.find((ing: any) => ing.month === month && ing.year === year)
      if (existing) {
        setIncomes(existing.incomes || [])
        if (existing.categoryExpenses) {
          setCategoryExpenses(existing.categoryExpenses)
        }
      } else {
        // Limpiar datos si cambiamos a un mes sin ingesta
        setIncomes([])
      }
    }
  }

  const addIncome = () => {
    // Validar que no haya ingresos sin bien asociado
    const incompleteIncomes = incomes.filter((income) => income.amount > 0 && !income.assetId)
    if (incompleteIncomes.length > 0) {
      setErrors((prev) => ({
        ...prev,
        incomes:
          "Completa todos los ingresos antes de agregar uno nuevo. Asigna un bien a cada ingreso con cantidad mayor a 0.",
      }))
      return
    }

    const newIncome: Income = {
      id: Date.now().toString(),
      amount: 0,
      assetId: "",
      description: "",
    }
    setIncomes([...incomes, newIncome])
    setErrors((prev) => ({ ...prev, incomes: "" }))
  }

  const updateIncome = (id: string, field: keyof Income, value: any) => {
    setIncomes(incomes.map((income) => (income.id === id ? { ...income, [field]: value } : income)))
    // Limpiar errores cuando se actualiza
    setErrors((prev) => ({ ...prev, incomes: "" }))
  }

  const removeIncome = (id: string) => {
    setIncomes(incomes.filter((income) => income.id !== id))
    setErrors((prev) => ({ ...prev, incomes: "" }))
  }

  const updateCategoryExpense = (categoryId: string, field: keyof CategoryExpense, value: any) => {
    setCategoryExpenses((prev) =>
      prev.map((expense) => (expense.categoryId === categoryId ? { ...expense, [field]: value } : expense)),
    )
  }

  const updateDistributionRule = (walletId: string, field: keyof DistributionRule, value: any) => {
    setDistributionRules((prev) =>
      prev.map((rule) => (rule.walletId === walletId ? { ...rule, [field]: value } : rule)),
    )
  }

  const saveDistributionRules = () => {
    localStorage.setItem("distributionRules", JSON.stringify(distributionRules))
    setIsDistributionDialogOpen(false)
  }

  const getCategoryExpense = (categoryId: string) => {
    return categoryExpenses.find((exp) => exp.categoryId === categoryId)
  }

  const getCategoryExcess = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    const expense = getCategoryExpense(categoryId)
    if (!category || !expense) return 0
    return Math.max(0, expense.amount - category.monthlyBudget)
  }

  const getCategorySurplus = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    const expense = getCategoryExpense(categoryId)
    if (!category || !expense) return 0
    return Math.max(0, category.monthlyBudget - expense.amount)
  }

  const isAccumulativeCategory = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    return (
      category &&
      (category.type === "gasto_acumulativo" ||
        category.type === "gasto_mixto" ||
        category.type === "gasto_acumulativo_opcional")
    )
  }

  const calculateWalletMovements = (): WalletMovement[] => {
    const movements: WalletMovement[] = []

    categoryExpenses.forEach((expense) => {
      const category = categories.find((cat) => cat.id === expense.categoryId)
      if (!category) return

      const excess = getCategoryExcess(expense.categoryId)
      const surplus = getCategorySurplus(expense.categoryId)

      // Solo crear movimiento si el exceso se cubre con un monedero específico
      if (excess > 0 && expense.walletId) {
        movements.push({
          walletId: expense.walletId,
          amount: -excess,
          type: "excess",
          description: `Exceso en ${category.name}: €${excess.toFixed(2)}`,
        })
      }

      if (surplus > 0 && isAccumulativeCategory(expense.categoryId) && expense.walletId) {
        movements.push({
          walletId: expense.walletId,
          amount: surplus,
          type: "accumulative",
          description: `Sobrante de ${category.name}: €${surplus.toFixed(2)}`,
        })
      }
    })

    return movements
  }

  const calculateTotals = () => {
    const totalBudget = categories.reduce((sum, cat) => sum + cat.monthlyBudget, 0)
    const totalSpent = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0)

    // Calcular excesos que se compensan con monederos específicos
    let excessesCoveredByWallets = 0

    categoryExpenses.forEach((expense) => {
      const category = categories.find((cat) => cat.id === expense.categoryId)
      if (category && expense.walletId) {
        const excess = Math.max(0, expense.amount - category.monthlyBudget)
        if (excess > 0) {
          excessesCoveredByWallets += excess
        }
      }
    })

    // El bote mensual se calcula como: ingresos - gastos + excesos compensados por monederos
    // Los excesos sin monedero asignado se restan automáticamente del bote
    const monthlyPot = totalIncome - totalSpent + excessesCoveredByWallets

    return { totalBudget, totalSpent, totalIncome, monthlyPot, excessesCoveredByWallets }
  }

  const calculateDistributionFromRules = (monthlyPot: number) => {
    const sortedRules = [...distributionRules].sort((a, b) => a.priority - b.priority)
    const distribution: { [walletId: string]: number } = {}
    let remainingAmount = monthlyPot

    // Primero aplicar cantidades fijas
    sortedRules
      .filter((rule) => rule.type === "fixed")
      .forEach((rule) => {
        const assignedAmount = Math.min(rule.value, remainingAmount)
        distribution[rule.walletId] = assignedAmount
        remainingAmount -= assignedAmount
      })

    // Luego aplicar porcentajes sobre el monto restante
    const percentageRules = sortedRules.filter((rule) => rule.type === "percentage")
    const totalPercentage = percentageRules.reduce((sum, rule) => sum + rule.value, 0)

    if (totalPercentage > 0 && remainingAmount > 0) {
      percentageRules.forEach((rule) => {
        const assignedAmount = (remainingAmount * rule.value) / totalPercentage
        distribution[rule.walletId] = (distribution[rule.walletId] || 0) + assignedAmount
      })
    }

    return distribution
  }

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

  const checkIfMonthExists = useCallback(() => {
    const savedIngestions = localStorage.getItem("monthlyIngestions")
    if (!savedIngestions) return false

    const ingestions = JSON.parse(savedIngestions)
    return ingestions.some((ing: any) => ing.month === month && ing.year === year)
  }, [month, year])

  // Función auxiliar para verificar si el bote puede cubrir un exceso
  const canPotCoverExcess = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    const expense = getCategoryExpense(categoryId)
    if (!category || !expense) return false

    const excess = Math.max(0, expense.amount - category.monthlyBudget)
    if (excess === 0) return false

    // Calcular bote preliminar sin considerar este exceso específico
    const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0)
    const totalSpent = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0)

    // Sumar excesos ya cubiertos por monederos (excluyendo el actual)
    let otherExcessesCoveredByWallets = 0
    let otherExcessesCoveredByPot = 0

    categoryExpenses.forEach((exp) => {
      if (exp.categoryId === categoryId) return // Excluir el actual

      const cat = categories.find((c) => c.id === exp.categoryId)
      if (cat) {
        const otherExcess = Math.max(0, exp.amount - cat.monthlyBudget)
        if (otherExcess > 0) {
          if (exp.walletId === "monthly-pot") {
            otherExcessesCoveredByPot += otherExcess
          } else if (exp.walletId) {
            otherExcessesCoveredByWallets += otherExcess
          }
        }
      }
    })

    const preliminaryPot = totalIncome - totalSpent + otherExcessesCoveredByWallets - otherExcessesCoveredByPot
    return preliminaryPot >= excess
  }

  const getValidationErrors = () => {
    const newErrors: { [key: string]: string } = {}

    // Verificar si el mes ya existe
    if (checkIfMonthExists()) {
      newErrors.month = `Ya existe una ingesta para ${month}/${year}. No se puede duplicar.`
    }

    // Verificar que categorías acumulativas con gasto tienen monedero asignado
    for (const expense of categoryExpenses) {
      if (expense.amount > 0 && isAccumulativeCategory(expense.categoryId) && !expense.walletId) {
        newErrors.categories = "Las categorías acumulativas con gasto deben tener un monedero asignado"
        break
      }
    }

    // Verificar que todos los ingresos tienen bien asignado
    for (const income of incomes) {
      if (income.amount > 0 && !income.assetId) {
        newErrors.incomes = "Todos los ingresos con cantidad deben tener un bien asociado"
        break
      }
    }

    // Validar que la distribución sume 100% si hay reglas activas
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

  const saveIngestion = () => {
    const validationErrors = getValidationErrors()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    // Convertir categoryExpenses a formato legacy para compatibilidad
    const expenses: { [categoryId: string]: number } = {}
    const walletAdjustments: { [categoryId: string]: string } = {}

    categoryExpenses.forEach((expense) => {
      expenses[expense.categoryId] = expense.amount
      if (expense.walletId) {
        walletAdjustments[expense.categoryId] = expense.walletId
      }
    })

    const ingestionData = {
      id: `${year}-${month}`,
      month,
      year,
      date: `${year}-${String(month).padStart(2, "0")}-01`,
      expenses,
      incomes,
      categoryExpenses,
      walletAdjustments,
      distributionRules,
    }

    // Guardar en localStorage
    const savedIngestions = localStorage.getItem("monthlyIngestions")
    const ingestions = savedIngestions ? JSON.parse(savedIngestions) : []

    ingestions.push(ingestionData)
    localStorage.setItem("monthlyIngestions", JSON.stringify(ingestions))

    // Actualizar saldos de monederos y bienes
    updateBalances(ingestionData)

    // Limpiar datos temporales
    localStorage.removeItem("tempIngestaData")

    // Disparar evento para actualizar otras pantallas
    window.dispatchEvent(new CustomEvent("ingestaCompleted"))

    alert("Ingesta guardada correctamente")
    router.push("/")
  }

  const updateBalances = (ingestionData: any) => {
    const movements = calculateWalletMovements()
    const totals = calculateTotals()
    const distribution = calculateDistributionFromRules(totals.monthlyPot)

    // Actualizar monederos
    const updatedWallets = wallets.map((wallet) => {
      let balanceChange = 0

      // Aplicar movimientos específicos de categorías
      movements.forEach((movement) => {
        if (movement.walletId === wallet.id) {
          balanceChange += movement.amount
        }
      })

      // Sumar distribución del bote mensual
      const distributionAmount = distribution[wallet.id] || 0
      balanceChange += distributionAmount

      return {
        ...wallet,
        currentBalance: wallet.currentBalance + balanceChange,
      }
    })

    // Actualizar bienes
    const updatedAssets = assets.map((asset) => {
      const assetIncomes = incomes.filter((income) => income.assetId === asset.id)
      const totalIncome = assetIncomes.reduce((sum, income) => sum + income.amount, 0)

      return {
        ...asset,
        currentBalance: asset.currentBalance + totalIncome,
      }
    })

    localStorage.setItem("wallets", JSON.stringify(updatedWallets))
    localStorage.setItem("assets", JSON.stringify(updatedAssets))
  }

  const totals = calculateTotals()
  const walletMovements = calculateWalletMovements()
  const walletSummary = getWalletMovementsSummary()
  const monthlyPotDistribution = calculateDistributionFromRules(totals.monthlyPot)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ingesta Mensual</h1>
          <p className="text-muted-foreground">Introduce los datos del mes</p>
        </div>
        <Button onClick={saveIngestion} disabled={Object.keys(errors).length > 0}>
          <Save className="mr-2 h-4 w-4" />
          Guardar Ingesta
        </Button>
      </div>

      {/* Errores generales */}
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

      {/* Selección de mes y año */}
      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
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
          <div className="space-y-2">
            <Label>Año</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number.parseInt(e.target.value))}
              className="w-24"
            />
          </div>
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

      {/* Gastos por categoría */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos por Categoría</CardTitle>
          <CardDescription>Introduce el gasto realizado en cada categoría</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.map((category) => {
            const expense = getCategoryExpense(category.id)
            const spent = expense?.amount || 0
            const excess = getCategoryExcess(category.id)
            const surplus = getCategorySurplus(category.id)
            const percentage = category.monthlyBudget > 0 ? (spent / category.monthlyBudget) * 100 : 0
            const isAccumulative = isAccumulativeCategory(category.id)

            return (
              <div key={category.id} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{category.name}</span>
                    <Badge variant="outline">{category.type.replace("_", " ")}</Badge>
                    {isAccumulative && <Badge variant="secondary">Requiere Monedero</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">Presupuesto: €{category.monthlyBudget.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Gasto realizado</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={spent}
                      onChange={(e) =>
                        updateCategoryExpense(category.id, "amount", Number.parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                    />
                  </div>

                  {(isAccumulative || excess > 0) && (
                    <div>
                      <Label>{isAccumulative ? "Monedero (obligatorio)" : "Cobertura del exceso (opcional)"}</Label>
                      <Select
                        value={expense?.walletId || ""}
                        onValueChange={(value) =>
                          updateCategoryExpense(category.id, "walletId", value === "none" ? "" : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={isAccumulative ? "Seleccionar monedero" : "Bote mensual (por defecto)"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {!isAccumulative && (
                            <SelectItem value="none">
                              <div className="flex items-center">
                                <TrendingUp className="mr-2 h-4 w-4 text-blue-600" />
                                Bote mensual (por defecto)
                              </div>
                            </SelectItem>
                          )}
                          {wallets.map((wallet) => (
                            <SelectItem key={wallet.id} value={wallet.id}>
                              {wallet.name} (€{wallet.currentBalance.toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex flex-col justify-end">
                    <Progress value={Math.min(percentage, 100)} className="mb-2" />
                    <div className="text-xs text-center">{percentage.toFixed(1)}% del presupuesto</div>
                  </div>
                </div>

                {excess > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Exceso de €{excess.toFixed(2)}</strong>
                      {expense?.walletId
                        ? ` - Se descontará del monedero "${wallets.find((w) => w.id === expense.walletId)?.name}"`
                        : " - Se descontará del bote mensual"}
                    </AlertDescription>
                  </Alert>
                )}

                {surplus > 0 && isAccumulative && (
                  <Alert className="border-green-200 bg-green-50">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Sobrante de €{surplus.toFixed(2)}</strong>
                      {expense?.walletId
                        ? ` - Se añadirá al monedero "${wallets.find((w) => w.id === expense.walletId)?.name}"`
                        : " - Selecciona un monedero para el sobrante"}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Ingresos */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos del Mes</CardTitle>
          <CardDescription>Registra todos los ingresos y su asignación a bienes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <Select value={income.assetId} onValueChange={(value) => updateIncome(income.id, "assetId", value)}>
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
              <Button variant="outline" size="icon" onClick={() => removeIncome(income.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="space-y-2">
            <Button onClick={addIncome} variant="outline" className="w-full bg-transparent">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Ingreso
            </Button>
            {errors.incomes && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{errors.incomes}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumen de movimientos de monederos */}
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
                        Saldo actual: €{wallet.currentBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {movements.map((movement, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span>{movement.description}</span>
                        <span className={movement.amount >= 0 ? "text-green-600" : "text-red-600"}>
                          {movement.amount >= 0 ? "+" : ""}€{movement.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {monthlyPotShare > 0 && (
                      <div className="flex justify-between items-center text-sm border-t pt-2">
                        <span>Bote mensual</span>
                        <span className="text-blue-600">+€{monthlyPotShare.toFixed(2)}</span>
                      </div>
                    )}

                    <Separator />
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

      {/* Resumen del mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Resumen del Mes
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
                  {distributionRules
                    .sort((a, b) => a.priority - b.priority)
                    .map((rule) => {
                      const wallet = wallets.find((w) => w.id === rule.walletId)
                      if (!wallet) return null

                      return (
                        <div key={rule.walletId} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{wallet.name}</span>
                            <Badge variant="outline">Prioridad {rule.priority}</Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label>Tipo</Label>
                              <Select
                                value={rule.type}
                                onValueChange={(value: "percentage" | "fixed") =>
                                  updateDistributionRule(rule.walletId, "type", value)
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

                            <div>
                              <Label>{rule.type === "percentage" ? "Porcentaje (%)" : "Cantidad (€)"}</Label>
                              <Input
                                type="number"
                                min="0"
                                step={rule.type === "percentage" ? "1" : "0.01"}
                                max={rule.type === "percentage" ? "100" : undefined}
                                value={rule.value}
                                onChange={(e) =>
                                  updateDistributionRule(rule.walletId, "value", Number.parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </div>

                            <div>
                              <Label>Prioridad</Label>
                              <Input
                                type="number"
                                min="1"
                                value={rule.priority}
                                onChange={(e) =>
                                  updateDistributionRule(
                                    rule.walletId,
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

          {totals.excessesCoveredByWallets > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Excesos cubiertos por monederos:</strong> €{totals.excessesCoveredByWallets.toFixed(2)} (no
                reducen el bote mensual)
              </div>
            </div>
          )}

          {(() => {
            // Calcular excesos que van al bote mensual
            const excessesToPot = categoryExpenses.reduce((sum, expense) => {
              const category = categories.find((cat) => cat.id === expense.categoryId)
              if (category && !expense.walletId) {
                const excess = Math.max(0, expense.amount - category.monthlyBudget)
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
