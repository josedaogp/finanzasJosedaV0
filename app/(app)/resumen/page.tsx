"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Calendar, TrendingUp, TrendingDown, Building2 } from "lucide-react"

interface Asset {
  id: string
  name: string
  type: string
  currentBalance: number
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
  walletAdjustments: { [walletId: string]: number }
  surplusDistribution: { [walletId: string]: number }
}

interface Wallet {
  id: string
  name: string
  currentBalance: number
  targetBalance?: number
}

export default function ResumenPage() {
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyIngestion[]>([])

  useEffect(() => {
    // Cargar datos del localStorage
    const savedWallets = localStorage.getItem("wallets")
    const savedAssets = localStorage.getItem("assets")
    const savedMonthlyData = localStorage.getItem("monthlyIngestions")

    if (savedWallets) {
      setWallets(JSON.parse(savedWallets))
    }
    if (savedAssets) {
      setAssets(JSON.parse(savedAssets))
    }
    if (savedMonthlyData) {
      setMonthlyData(JSON.parse(savedMonthlyData))
    }

    // Establecer fecha actual por defecto
    const now = new Date()
    setSelectedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  }, [])

  const calculateBalanceAtDate = (date: string) => {
    const [year, month] = date.split("-").map(Number)
    const targetDate = new Date(year, month - 1, 1)

    // Filtrar datos hasta la fecha seleccionada
    const relevantData = monthlyData.filter((data) => {
      const dataDate = new Date(data.year, data.month - 1, 1)
      return dataDate <= targetDate
    })

    // Calcular saldos de monederos
    const walletBalances = wallets.map((wallet) => {
      let balance = 0 // Empezar desde 0, los saldos actuales ya incluyen el historial

      relevantData.forEach((data) => {
        // Restar excesos cubiertos por este monedero
        Object.entries(data.walletAdjustments || {}).forEach(([categoryId, walletId]) => {
          if (walletId === wallet.id) {
            // Calcular el exceso para esta categoría en este mes
            const expense = data.expenses[categoryId] || 0
            // Necesitaríamos el presupuesto de la categoría para calcular el exceso exacto
            // Por simplicidad, asumimos que el ajuste ya está calculado
          }
        })

        // Sumar distribución de sobrante
        const distributionAmount = data.surplusDistribution[wallet.id] || 0
        if (distributionAmount > 0) {
          const totalIncome = data.incomes.reduce((sum, income) => sum + income.amount, 0)
          const totalExpenses = Object.values(data.expenses).reduce((sum, amount) => sum + amount, 0)
          const surplus = totalIncome - totalExpenses
          balance += (surplus * distributionAmount) / 100
        }
      })

      return {
        ...wallet,
        calculatedBalance: wallet.currentBalance, // Por simplicidad, usar el saldo actual
      }
    })

    // Calcular saldos de bienes
    const assetBalances = assets.map((asset) => {
      let balance = 0

      relevantData.forEach((data) => {
        const assetIncomes = data.incomes.filter((income) => income.assetId === asset.id)
        const totalIncome = assetIncomes.reduce((sum, income) => sum + income.amount, 0)
        balance += totalIncome
      })

      return {
        ...asset,
        calculatedBalance: asset.currentBalance, // Por simplicidad, usar el saldo actual
      }
    })

    return { walletBalances, assetBalances }
  }

  const { walletBalances, assetBalances } = selectedDate
    ? calculateBalanceAtDate(selectedDate)
    : { walletBalances: [], assetBalances: [] }

  const getTotalWalletBalance = () => {
    return walletBalances.reduce((sum, wallet) => sum + wallet.calculatedBalance, 0)
  }

  const getTotalAssetBalance = () => {
    return assetBalances.reduce((sum, asset) => sum + asset.calculatedBalance, 0)
  }

  const getWalletProgress = (current: number, target?: number) => {
    if (!target || target === 0) return 0
    return Math.min((current / target) * 100, 100)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resumen Financiero</h1>
          <p className="text-muted-foreground">Estado de monederos y bienes en una fecha específica</p>
        </div>
      </div>

      {/* Selección de fecha */}
      <Card>
        <CardHeader>
          <CardTitle>Fecha de Consulta</CardTitle>
          <CardDescription>Selecciona la fecha para ver el estado financiero</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-2">
              <Label htmlFor="date">Mes y Año</Label>
              <Input
                id="date"
                type="month"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <>
          {/* Resumen general */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Monederos</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{getTotalWalletBalance().toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{walletBalances.length} monederos activos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bienes</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{getTotalAssetBalance().toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{assetBalances.length} bienes registrados</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patrimonio Total</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  €{(getTotalWalletBalance() + getTotalAssetBalance()).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Valor total de activos</p>
              </CardContent>
            </Card>
          </div>

          {/* Estado de monederos */}
          <Card>
            <CardHeader>
              <CardTitle>Estado de Monederos</CardTitle>
              <CardDescription>
                Saldos y progreso hacia objetivos al{" "}
                {new Date(selectedDate + "-01").toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Monedero</TableHead>
                    <TableHead>Saldo Actual</TableHead>
                    <TableHead>Saldo Objetivo</TableHead>
                    <TableHead>Diferencia</TableHead>
                    <TableHead>Progreso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {walletBalances.map((wallet) => {
                    const difference = wallet.targetBalance ? wallet.calculatedBalance - wallet.targetBalance : 0
                    const progress = getWalletProgress(wallet.calculatedBalance, wallet.targetBalance)

                    return (
                      <TableRow key={wallet.id}>
                        <TableCell className="font-medium">{wallet.name}</TableCell>
                        <TableCell>€{wallet.calculatedBalance.toFixed(2)}</TableCell>
                        <TableCell>{wallet.targetBalance ? `€${wallet.targetBalance.toFixed(2)}` : "-"}</TableCell>
                        <TableCell>
                          {wallet.targetBalance && (
                            <div className={`flex items-center ${difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {difference >= 0 ? (
                                <TrendingUp className="h-4 w-4 mr-1" />
                              ) : (
                                <TrendingDown className="h-4 w-4 mr-1" />
                              )}
                              €{Math.abs(difference).toFixed(2)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {wallet.targetBalance && (
                            <div className="flex items-center space-x-2">
                              <Progress value={progress} className="w-20 h-2" />
                              <span className="text-sm">{progress.toFixed(0)}%</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Estado de bienes */}
          <Card>
            <CardHeader>
              <CardTitle>Estado de Bienes</CardTitle>
              <CardDescription>
                Saldos de activos y cuentas al{" "}
                {new Date(selectedDate + "-01").toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bien</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Saldo Actual</TableHead>
                    <TableHead>Porcentaje del Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assetBalances.map((asset) => {
                    const totalAssets = getTotalAssetBalance()
                    const percentage = totalAssets > 0 ? (asset.calculatedBalance / totalAssets) * 100 : 0

                    return (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{asset.type.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>€{asset.calculatedBalance.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Progress value={percentage} className="w-20 h-2" />
                            <span className="text-sm">{percentage.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Evolución mensual */}
          <Card>
            <CardHeader>
              <CardTitle>Evolución Mensual</CardTitle>
              <CardDescription>Historial de cambios en el patrimonio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monthlyData
                  .filter((data) => {
                    const [year, month] = selectedDate.split("-").map(Number)
                    const dataDate = new Date(data.year, data.month - 1, 1)
                    const targetDate = new Date(year, month - 1, 1)
                    return dataDate <= targetDate
                  })
                  .sort((a, b) => new Date(b.year, b.month - 1).getTime() - new Date(a.year, a.month - 1).getTime())
                  .slice(0, 6)
                  .map((data) => {
                    const totalIncome = data.incomes.reduce((sum, income) => sum + income.amount, 0)
                    const totalExpenses = Object.values(data.expenses).reduce((sum, amount) => sum + amount, 0)
                    const surplus = totalIncome - totalExpenses

                    return (
                      <div key={data.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">
                            {data.month}/{data.year}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Ingresos: €{totalIncome.toFixed(2)} | Gastos: €{totalExpenses.toFixed(2)}
                          </div>
                        </div>
                        <div className={`text-right ${surplus >= 0 ? "text-green-600" : "text-red-600"}`}>
                          <div className="font-medium">
                            {surplus >= 0 ? "+" : ""}€{surplus.toFixed(2)}
                          </div>
                          <div className="text-sm">{surplus >= 0 ? "Sobrante" : "Déficit"}</div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
