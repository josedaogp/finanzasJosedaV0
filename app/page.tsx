"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import Link from "next/link"
import { getCategories } from "@/services/categoryService"
import { getMonthlyIngestion } from "@/services/ingestionService"
import { Category, EnrichedCategory, EnrichedMonthlyIngestion, MonthlyIngestion } from "@/types/models"

// TO-DO: BORRAR ESTO CUANDO NO SEA NECESARIO
// interface Category {
//   id: string
//   name: string
//   type: "gasto" | "gasto_acumulativo" | "gasto_mixto" | "gasto_acumulativo_opcional"
//   monthlyBudget: number
//   annualBudget?: number
//   active: boolean
//   walletId?: string
// }

// interface MonthlyIngestion {
//   id: string
//   month: number
//   year: number
//   date: string
//   expenses: { [categoryId: string]: number }
//   incomes: Array<{
//     id: string
//     amount: number
//     assetId: string
//     description?: string
//   }>
//   walletAdjustments: { [walletId: string]: number }
//   surplusDistribution: { [walletId: string]: number }
// }

export default function HomePage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [monthlyData, setMonthlyData] = useState<EnrichedMonthlyIngestion[]>([])
  const [categories, setCategories] = useState<EnrichedCategory[]>([])

  // useEffect(() => {
  //   // Cargar datos del localStorage
  //   const savedData = localStorage.getItem("monthlyIngestions")
  //   const savedCategories = localStorage.getItem("categories")

  //   if (savedData) {
  //     setMonthlyData(JSON.parse(savedData))
  //   }
  //   if (savedCategories) {
  //     setCategories(JSON.parse(savedCategories))
  //   }

  //   // Establecer mes actual por defecto
  //   const now = new Date()
  //   setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  // }, [])
  useEffect(() => {
    const load = async () => {
      const cats = await getCategories()
      setCategories(cats)

      const now = new Date()
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      setSelectedMonth(monthKey)

      const data = await getMonthlyIngestion(now.getFullYear(), now.getMonth() + 1)
      if (data) {
        setMonthlyData([data]) // o guarda más si cargas múltiples meses
      }
    }

    load()
  }, [])
  
  useEffect(() => {
    const handleIngestaCompleted = () => {
      // Recargar datos del localStorage
      const savedData = localStorage.getItem("monthlyIngestions")
      const savedCategories = localStorage.getItem("categories")

      if (savedData) {
        setMonthlyData(JSON.parse(savedData))
      }
      if (savedCategories) {
        setCategories(JSON.parse(savedCategories))
      }
    }

    window.addEventListener("ingestaCompleted", handleIngestaCompleted)
    return () => window.removeEventListener("ingestaCompleted", handleIngestaCompleted)
  }, [])

  // const getMonthData = (monthKey: string) => {
  //   return monthlyData.find((data) => {
  //     const [year, month] = monthKey.split("-")
  //     return data.year === Number.parseInt(year) && data.month === Number.parseInt(month)
  //   })
  // }
  const getMonthData = (monthKey: string): EnrichedMonthlyIngestion | undefined => {
    return monthlyData.find((data) => {
      const [year, month] = monthKey.split("-")
      return data.year === Number.parseInt(year) && data.month === Number.parseInt(month)
    })
  }

  const calculateCategoryStats = (monthData: EnrichedMonthlyIngestion | undefined) => {
    if (!monthData) return []

    return categories
      .filter((cat) => cat.active)
      .map((category) => {
        const spent = monthData.expenses
          .filter((exp) => exp.category_id === category.id)
          .reduce((sum, exp) => sum + exp.amount, 0)

        const budget = category.monthly_budget
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
}


  const calculateTotals = (monthData: EnrichedMonthlyIngestion | undefined) => {
    if (!monthData) return { totalBudget: 0, totalSpent: 0, totalIncome: 0, surplus: 0 }

    const totalBudget = categories.filter((cat) => cat.active).reduce((sum, cat) => sum + cat.monthly_budget, 0)
    const totalSpent = monthData.expenses.reduce((sum, exp) => sum + exp.amount, 0)
    const totalIncome = monthData.incomes.reduce((sum, income) => sum + income.amount, 0)
    const surplus = totalIncome - totalSpent

    return { totalBudget, totalSpent, totalIncome, surplus }
}


  const monthData = getMonthData(selectedMonth)
  const categoryStats = calculateCategoryStats(monthData)
  const totals = calculateTotals(monthData)

  const availableMonths = monthlyData.map((data) => ({
    key: `${data.year}-${String(data.month).padStart(2, "0")}`,
    label: `${data.month}/${data.year}`,
  }))

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

      <div className="flex gap-4 items-center">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Seleccionar mes" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((month) => (
              <SelectItem key={month.key} value={month.key}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {monthData ? (
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
              <div className="space-y-4">
                {categoryStats.map((stat) => (
                  <div key={stat.category.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{stat.category.name}</span>
                        <Badge
                          variant={
                            stat.status === "excess" ? "destructive" : stat.status === "exact" ? "default" : "secondary"
                          }
                        >
                          {stat.category.category_types?.name.replace("_", " ")}
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
            </CardContent>
          </Card>

          {/* Ingresos del mes */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos del Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monthData.incomes.map((income) => (
                  <div key={income.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <div className="font-medium">€{income.amount.toFixed(2)}</div>
                      {income.description && <div className="text-sm text-muted-foreground">{income.description}</div>}
                    </div>
                    <Badge variant="outline">Bien: {income.asset_id}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay datos para este mes</h3>
            <p className="text-muted-foreground mb-4">Introduce los datos del mes para ver el resumen</p>
            <Link href="/ingesta">
              <Button>Crear Ingesta Mensual</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
