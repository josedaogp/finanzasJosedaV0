"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, TrendingUp, TrendingDown, ArrowRight, Filter, Eye } from "lucide-react"
import Link from "next/link"

interface Wallet {
  id: string
  name: string
  currentBalance: number
  targetBalance?: number
}

interface MonthlyIngestion {
  id: string
  month: number
  year: number
  date: string
  expenses: { [categoryId: string]: number }
  incomes: Array<{
    id: string
    amount: number
    assetId: string
    description?: string
  }>
  categoryExpenses?: Array<{
    categoryId: string
    amount: number
    walletId?: string
  }>
  walletAdjustments: { [walletId: string]: string }
  surplusDistribution: { [walletId: string]: number }
}

interface Category {
  id: string
  name: string
  type: "gasto" | "gasto_acumulativo" | "gasto_mixto" | "gasto_acumulativo_opcional"
  monthlyBudget: number
}

interface MonthlySnapshot {
  month: number
  year: number
  date: string
  wallets: Array<{
    id: string
    name: string
    balance: number
    targetBalance?: number
    change: number
    changePercentage: number
  }>
  totalBalance: number
  totalChange: number
  ingestionId: string
}

export default function EvolucionPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyIngestion[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([])
  const [selectedWallet, setSelectedWallet] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (wallets.length > 0 && monthlyData.length > 0) {
      calculateSnapshots()
    }
  }, [wallets, monthlyData, categories])

  const loadData = () => {
    const savedWallets = localStorage.getItem("wallets")
    const savedMonthlyData = localStorage.getItem("monthlyIngestions")
    const savedCategories = localStorage.getItem("categories")

    if (savedWallets) {
      setWallets(JSON.parse(savedWallets))
    }
    if (savedMonthlyData) {
      setMonthlyData(JSON.parse(savedMonthlyData))
    }
    if (savedCategories) {
      setCategories(JSON.parse(savedCategories))
    }

    // Establecer fechas por defecto (últimos 6 meses)
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    setStartDate(`${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}`)
    setEndDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  }

  const calculateSnapshots = () => {
    const snapshots: MonthlySnapshot[] = []

    // Ordenar datos por fecha
    const sortedData = [...monthlyData].sort((a, b) => {
      const dateA = new Date(a.year, a.month - 1)
      const dateB = new Date(b.year, b.month - 1)
      return dateA.getTime() - dateB.getTime()
    })

    // Simular saldos iniciales (en una implementación real, esto vendría de la base de datos)
    const walletBalances: { [walletId: string]: number } = {}
    const previousBalances: { [walletId: string]: number } = {}

    wallets.forEach((wallet) => {
      walletBalances[wallet.id] = 0 // Empezar desde 0 para la simulación
      previousBalances[wallet.id] = 0
    })

    sortedData.forEach((ingestion, index) => {
      // Guardar saldos anteriores
      Object.keys(walletBalances).forEach((walletId) => {
        previousBalances[walletId] = walletBalances[walletId]
      })

      const totalIncome = ingestion.incomes.reduce((sum, income) => sum + income.amount, 0)
      const totalExpenses = Object.values(ingestion.expenses).reduce((sum, amount) => sum + amount, 0)
      const monthlyPot = totalIncome - totalExpenses

      wallets.forEach((wallet) => {
        let excesses = 0
        let surpluses = 0
        let monthlyPotShare = 0

        // Calcular excesos cubiertos por este monedero
        Object.entries(ingestion.walletAdjustments || {}).forEach(([categoryId, walletId]) => {
          if (walletId === wallet.id) {
            const expense = ingestion.expenses[categoryId] || 0
            const category = categories.find((cat) => cat.id === categoryId)
            if (category) {
              const excess = Math.max(0, expense - category.monthlyBudget)
              excesses -= excess
            }
          }
        })

        // Calcular sobrantes de categorías acumulativas
        if (ingestion.categoryExpenses) {
          ingestion.categoryExpenses.forEach((categoryExpense) => {
            if (categoryExpense.walletId === wallet.id) {
              const category = categories.find((cat) => cat.id === categoryExpense.categoryId)
              if (
                category &&
                (category.type === "gasto_acumulativo" ||
                  category.type === "gasto_mixto" ||
                  category.type === "gasto_acumulativo_opcional")
              ) {
                const surplus = Math.max(0, category.monthlyBudget - categoryExpense.amount)
                surpluses += surplus
              }
            }
          })
        }

        // Calcular distribución del bote mensual
        const distributionPercentage = ingestion.surplusDistribution[wallet.id] || 0
        if (monthlyPot > 0) {
          monthlyPotShare = (monthlyPot * distributionPercentage) / 100
        }

        const totalMovement = excesses + surpluses + monthlyPotShare
        walletBalances[wallet.id] += totalMovement
      })

      // Crear snapshot del mes
      const walletSnapshots = wallets.map((wallet) => {
        const currentBalance = walletBalances[wallet.id]
        const previousBalance = previousBalances[wallet.id]
        const change = currentBalance - previousBalance
        const changePercentage = previousBalance !== 0 ? (change / Math.abs(previousBalance)) * 100 : 0

        return {
          id: wallet.id,
          name: wallet.name,
          balance: currentBalance,
          targetBalance: wallet.targetBalance,
          change,
          changePercentage,
        }
      })

      const totalBalance = walletSnapshots.reduce((sum, w) => sum + w.balance, 0)
      const totalChange = walletSnapshots.reduce((sum, w) => sum + w.change, 0)

      snapshots.push({
        month: ingestion.month,
        year: ingestion.year,
        date: `${ingestion.year}-${String(ingestion.month).padStart(2, "0")}`,
        wallets: walletSnapshots,
        totalBalance,
        totalChange,
        ingestionId: ingestion.id,
      })
    })

    setSnapshots(snapshots)
  }

  const getFilteredSnapshots = () => {
    let filtered = snapshots

    // Filtrar por fechas
    if (startDate && endDate) {
      filtered = filtered.filter((snapshot) => {
        const snapshotDate = snapshot.date
        return snapshotDate >= startDate && snapshotDate <= endDate
      })
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.year, a.month - 1)
      const dateB = new Date(b.year, b.month - 1)
      return dateB.getTime() - dateA.getTime() // Más reciente primero
    })
  }

  const getWalletProgress = (balance: number, target?: number) => {
    if (!target) return 0
    return Math.min((balance / target) * 100, 100)
  }

  const formatMonthYear = (month: number, year: number) => {
    return new Date(year, month - 1).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    })
  }

  const filteredSnapshots = getFilteredSnapshots()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Evolución de Monederos</h1>
          <p className="text-muted-foreground">Capturas mensuales del estado de tus monederos</p>
        </div>
        <Link href="/configuracion">
          <Button variant="outline">Configurar Distribución</Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div className="space-y-2">
            <Label>Desde</Label>
            <Input type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-48" />
          </div>

          <div className="space-y-2">
            <Label>Hasta</Label>
            <Input type="month" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-48" />
          </div>

          <div className="space-y-2">
            <Label>Monedero</Label>
            <Select value={selectedWallet} onValueChange={setSelectedWallet}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los monederos</SelectItem>
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Galería de snapshots mensuales */}
      {filteredSnapshots.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Capturas Mensuales</h2>
            <Badge variant="outline">{filteredSnapshots.length} meses</Badge>
          </div>

          {/* Scroll horizontal de snapshots */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6 min-w-max">
              {filteredSnapshots.map((snapshot) => (
                <Card key={`${snapshot.year}-${snapshot.month}`} className="min-w-[400px] flex-shrink-0">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{formatMonthYear(snapshot.month, snapshot.year)}</CardTitle>
                      <Link href={`/ingesta?month=${snapshot.month}&year=${snapshot.year}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Ingesta
                        </Button>
                      </Link>
                    </div>
                    <CardDescription>
                      Total: €{snapshot.totalBalance.toFixed(2)}
                      {snapshot.totalChange !== 0 && (
                        <span className={`ml-2 ${snapshot.totalChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ({snapshot.totalChange >= 0 ? "+" : ""}€{snapshot.totalChange.toFixed(2)})
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {snapshot.wallets
                      .filter((wallet) => selectedWallet === "all" || wallet.id === selectedWallet)
                      .map((wallet) => {
                        const progress = getWalletProgress(wallet.balance, wallet.targetBalance)

                        return (
                          <div key={wallet.id} className="p-3 border rounded-lg bg-slate-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{wallet.name}</span>
                              {wallet.change !== 0 && (
                                <div
                                  className={`flex items-center text-xs ${wallet.change >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {wallet.change >= 0 ? (
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                  )}
                                  {wallet.change >= 0 ? "+" : ""}€{wallet.change.toFixed(2)}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">€{wallet.balance.toFixed(2)}</span>
                                {wallet.targetBalance && (
                                  <span className="text-xs text-muted-foreground">
                                    / €{wallet.targetBalance.toFixed(2)}
                                  </span>
                                )}
                              </div>

                              {wallet.targetBalance && (
                                <div className="space-y-1">
                                  <Progress value={progress} className="h-1.5" />
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{progress.toFixed(1)}% del objetivo</span>
                                    <span>
                                      {wallet.balance >= wallet.targetBalance
                                        ? "✅ Completado"
                                        : `Faltan €${(wallet.targetBalance - wallet.balance).toFixed(2)}`}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Resumen de tendencias */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Tendencias</CardTitle>
              <CardDescription>Análisis del período seleccionado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(() => {
                  const firstSnapshot = filteredSnapshots[filteredSnapshots.length - 1]
                  const lastSnapshot = filteredSnapshots[0]
                  const totalGrowth = lastSnapshot ? lastSnapshot.totalBalance - (firstSnapshot?.totalBalance || 0) : 0
                  const growthPercentage = firstSnapshot?.totalBalance
                    ? (totalGrowth / firstSnapshot.totalBalance) * 100
                    : 0

                  return (
                    <>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold">€{lastSnapshot?.totalBalance.toFixed(2) || "0.00"}</div>
                        <div className="text-sm text-muted-foreground">Balance Actual</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className={`text-2xl font-bold ${totalGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {totalGrowth >= 0 ? "+" : ""}€{totalGrowth.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Crecimiento Total</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div
                          className={`text-2xl font-bold ${growthPercentage >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {growthPercentage >= 0 ? "+" : ""}
                          {growthPercentage.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">% de Crecimiento</div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay datos de evolución</h3>
            <p className="text-muted-foreground mb-4 text-center">
              {startDate && endDate
                ? "No hay ingestas en el período seleccionado. Ajusta los filtros o crea nuevas ingestas."
                : "Realiza algunas ingestas mensuales para ver la evolución de tus monederos"}
            </p>
            <Link href="/ingesta">
              <Button>
                Crear Ingesta Mensual
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
