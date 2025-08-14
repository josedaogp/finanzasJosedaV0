"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import Link from "next/link"
import { getCategories } from "@/services/categoryService"
import { getMonthlyIngestion, getMonthlyIngestionsIndex } from "@/services/ingestionService"
import { EnrichedCategory, EnrichedMonthlyIngestion } from "@/types/models"

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
]
const monthName = (m: number) => {
  const idx = (m - 1 + 12) % 12
  const base = MONTH_NAMES_ES[idx] || String(m)
  return base.charAt(0).toUpperCase() + base.slice(1)
}

// Helpers para leer claves con nombres alternativos
const getCategoryId = (exp: any) => exp?.category_id ?? exp?.categoryId ?? exp?.category ?? null
const getAssetId = (inc: any) => inc?.assets?.name || inc?.asset_id;

export default function HomePage() {
  // UI state
  const [selectedYear, setSelectedYear] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  // Data state
  const [years, setYears] = useState<number[]>([])
  const [monthsByYear, setMonthsByYear] = useState<Record<number, number[]>>({})
  const [categories, setCategories] = useState<EnrichedCategory[]>([])
  const [monthData, setMonthData] = useState<EnrichedMonthlyIngestion | null>(null)

  // Loading / error
  const [loadingIndex, setLoadingIndex] = useState<boolean>(true)
  const [loadingMonth, setLoadingMonth] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // 1) Cargar índice de meses/años y categorías
  useEffect(() => {
    const loadIndex = async () => {
      try {
        setLoadingIndex(true)
        setError(null)

        const cats = await getCategories()
        setCategories(Array.isArray(cats) ? cats : [])

        const rows = await getMonthlyIngestionsIndex() // [{year, month}]
        const map: Record<number, number[]> = {}
        for (const r of rows) {
          if (!map[r.year]) map[r.year] = []
          if (!map[r.year].includes(r.month)) map[r.year].push(r.month)
        }
        Object.keys(map).forEach((y) => map[+y].sort((a, b) => b - a))
        const yearList = Object.keys(map).map(Number).sort((a, b) => b - a)

        setYears(yearList)
        setMonthsByYear(map)

        if (yearList.length) {
          setSelectedYear(String(yearList[0]))
          setSelectedMonth(String(map[yearList[0]][0]))
        } else {
          setSelectedYear("")
          setSelectedMonth("")
          setMonthData(null)
        }
      } catch (e: any) {
        setError(e?.message ?? "Error cargando el índice de meses.")
      } finally {
        setLoadingIndex(false)
      }
    }

    loadIndex()
  }, [])

  // 2) Cargar datos del mes seleccionado cuando cambien año/mes
  useEffect(() => {
    const loadMonth = async () => {
      if (!selectedYear || !selectedMonth) {
        setMonthData(null)
        return
      }

      try {
        setLoadingMonth(true)
        setError(null)
        const y = Number.parseInt(selectedYear, 10)
        const m = Number.parseInt(selectedMonth, 10)

        // Si usas multiusuario, pasa aquí el user_id como tercer argumento
        const data = await getMonthlyIngestion(y, m /*, userId*/)

        setMonthData((data || null) as EnrichedMonthlyIngestion | null)
      } catch (e: any) {
        setError(e?.message ?? "Error cargando los datos del mes.")
        setMonthData(null)
      } finally {
        setLoadingMonth(false)
      }
    }

    loadMonth()
  }, [selectedYear, selectedMonth])

  // Si cambia el año, asegurar que el mes seleccionado existe en ese año
  useEffect(() => {
    if (!selectedYear) return
    const y = Number(selectedYear)
    const available = monthsByYear[y] || []
    if (available.length === 0) {
      setSelectedMonth("")
    } else if (!available.includes(Number(selectedMonth))) {
      setSelectedMonth(String(available[0]))
    }
  }, [selectedYear, monthsByYear])

  // Normalización y validación “defensiva”
  const safeMonthData = useMemo<EnrichedMonthlyIngestion | null>(() => {
    if (!monthData) return null
    const expenses = Array.isArray((monthData as any).expenses) ? (monthData as any).expenses : []
    const incomes = Array.isArray((monthData as any).incomes) ? (monthData as any).incomes : []

    const normExpenses = expenses
      .filter((e: any) => e && typeof e.amount !== "undefined" && getCategoryId(e))
      .map((e: any) => ({
        ...e,
        amount: Number(e.amount) || 0,
        // categoría tolerante
        category_id: getCategoryId(e),
      }))

    const normIncomes = incomes
      .filter((i: any) => i && typeof i.amount !== "undefined")
      .map((i: any) => ({
        ...i,
        amount: Number(i.amount) || 0,
        asset_id: getAssetId(i),
      }))

    return { ...monthData, expenses: normExpenses, incomes: normIncomes } as EnrichedMonthlyIngestion
  }, [monthData])

  const categoryStats = useMemo(() => {
    if (!safeMonthData) return []
    return categories
      .filter((cat) => cat.active)
      .map((category) => {
        const spent = safeMonthData.expenses
          .filter((exp: any) => exp.category_id === category.id)
          .reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0)

        const budget = Number(category.monthly_budget) || 0
        const difference = budget - spent
        const percentage = budget > 0 ? (spent / budget) * 100 : 0

        return {
          category,
          spent,
          budget,
          difference,
          percentage,
          status: spent > budget ? "excess" : spent === budget ? "exact" : "under",
        }
      })
  }, [categories, safeMonthData])

  const totals = useMemo(() => {
    if (!safeMonthData) return { totalBudget: 0, totalSpent: 0, totalIncome: 0, surplus: 0 }
    const totalBudget = categories
      .filter((c) => c.active)
      .reduce((acc, c) => acc + (Number(c.monthly_budget) || 0), 0)
    const totalSpent = safeMonthData.expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)
    const totalIncome = safeMonthData.incomes.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
    const surplus = totalIncome - totalSpent
    return { totalBudget, totalSpent, totalIncome, surplus }
  }, [categories, safeMonthData])

  const availableMonthsForYear = useMemo(() => {
    const y = Number(selectedYear)
    const arr = monthsByYear[y] || []
    return arr.map((m) => ({ value: String(m), label: `${monthName(m)} (${String(m).padStart(2, "0")})` }))
  }, [selectedYear, monthsByYear])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Histórico de Meses</h1>
          <p className="text-muted-foreground">Resumen financiero mensual</p>
        </div>
        <Link href="/ingesta">
          <Button>
            <Calendar className="mr-2 h-4 w-4" />
            Nueva Ingesta
          </Button>
        </Link>
      </div>

      {/* Selectores Año → Mes */}
      <div className="flex gap-4 items-center">
        <Select
          value={selectedYear}
          onValueChange={(v) => setSelectedYear(v)}
          disabled={loadingIndex || years.length === 0}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={loadingIndex ? "Cargando años..." : "Seleccionar año"} />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedMonth}
          onValueChange={(v) => setSelectedMonth(v)}
          disabled={loadingIndex || !selectedYear || (monthsByYear[Number(selectedYear)]?.length ?? 0) === 0}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder={!selectedYear ? "Elige un año primero" : "Seleccionar mes"} />
          </SelectTrigger>
          <SelectContent>
            {availableMonthsForYear.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Estados de carga / error */}
      {error && (
        <Card>
          <CardContent className="py-4">
            <p className="text-red-600">⚠️ {error}</p>
          </CardContent>
        </Card>
      )}

      {loadingMonth && (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground">Cargando datos del mes...</p>
          </CardContent>
        </Card>
      )}

      {/* Contenido principal */}
      {!loadingMonth && safeMonthData ? (
        <div className="space-y-6">
          {/* Resumen general */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{totals.totalBudget.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{totals.totalSpent.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{totals.totalIncome.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sobrante</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totals.surplus >= 0 ? "text-green-600" : "text-red-600"}`}>
                  €{totals.surplus.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalle por categorías */}
          <Card>
            <CardHeader>
              <CardTitle>Gasto por Categorías</CardTitle>
              <CardDescription>Comparación entre presupuesto y gasto real</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay categorías activas o no hay gastos registrados.</p>
              ) : (
                <div className="space-y-4">
                  {categoryStats.map((stat) => (
                    <div key={stat.category.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stat.category.name}</span>
                          <Badge
                            variant={
                              stat.status === "excess"
                                ? "destructive"
                                : stat.status === "exact"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {(stat.category.category_types?.name || "")
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase())}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            €{stat.spent.toFixed(2)} / €{stat.budget.toFixed(2)}
                          </div>
                          <div className={`text-sm ${stat.difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {stat.difference >= 0 ? "+" : ""}€{stat.difference.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <Progress
                        value={Math.min(stat.percentage, 100)}
                        className={`h-2 ${stat.status === "excess" ? "bg-red-100" : ""}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ingresos del mes */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos del Mes</CardTitle>
            </CardHeader>
            <CardContent>
              {safeMonthData.incomes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay ingresos registrados para este mes.</p>
              ) : (
                <div className="space-y-2">
                  {safeMonthData.incomes.map((income: any) => (
                    <div key={income.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <div className="font-medium">€{Number(income.amount || 0).toFixed(2)}</div>
                        {income.description && (
                          <div className="text-sm text-muted-foreground">{income.description}</div>
                        )}
                      </div>
                      <Badge variant="outline">Bien: {getAssetId(income)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        !loadingIndex && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {years.length === 0 ? "No hay ingestas registradas" : "No hay datos para este mes"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {years.length === 0
                  ? "Crea tu primera ingesta mensual para empezar."
                  : "Introduce o corrige los datos del mes para ver el resumen."}
              </p>
              <Link href="/ingesta">
                <Button>Crear Ingesta Mensual</Button>
              </Link>
            </CardContent>
          </Card>
        )
      )}
    </div>
  )
}
