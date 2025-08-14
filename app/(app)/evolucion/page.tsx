"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, TrendingUp, TrendingDown, ArrowRight, Filter, Eye, Building2 } from "lucide-react"
import Link from "next/link"

import { useRequireAuth } from "@/hooks/useRequireAuth"
import { fetchWallets } from "@/services/walletService"
import { getMonthlyIngestion, getMonthlyIngestionsIndex } from "@/services/ingestionService"
import { fetchWalletTransactionsByIngestionIds } from "@/services/walletTransactionService"
import { EnrichedMonthlyIngestion } from "@/types/models"

type Wallet = {
  id: string
  name: string
  current_balance: number
  target_balance?: number | null
}

type WalletTransaction = {
  id: string
  user_id: string
  wallet_id: string
  monthly_ingestion_id: string | null
  amount: number
  created_at: string
}

type MonthlySnapshot = {
  month: number
  year: number
  date: string // "YYYY-MM"
  wallets: Array<{
    id: string
    name: string
    balance: number
    targetBalance?: number | null
    change: number
    changePercentage: number
  }>
  totalBalance: number
  totalChange: number
  ingestionId: string
}

export default function EvolucionPage() {
  const session = useRequireAuth()
  if (!session) return null

  // Datos base
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [availableMonths, setAvailableMonths] = useState<{ year: number; month: number }[]>([])

  // Filtros UI
  const [selectedWallet, setSelectedWallet] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("") // "YYYY-MM"
  const [endDate, setEndDate] = useState<string>("")     // "YYYY-MM"

  // Datos cargados
  const [monthsInRange, setMonthsInRange] = useState<Array<{ year: number; month: number; ingestionId: string }>>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([])

  // Loading / error
  const [loadingIndex, setLoadingIndex] = useState<boolean>(true)
  const [loadingData, setLoadingData] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // 1) Cargar wallets + índice de ingestas; preparar rango por defecto (últimos 6 meses disponibles)
  useEffect(() => {
    const loadBasics = async () => {
      try {
        setLoadingIndex(true)
        setError(null)

        const [ws, idx] = await Promise.all([fetchWallets(), getMonthlyIngestionsIndex()])

        const mappedWallets: Wallet[] = (ws || []).map((w: any) => ({
          id: w.id,
          name: w.name,
          current_balance: Number(w.current_balance ?? w.currentBalance ?? 0),
          target_balance: w.target_balance ?? w.targetBalance ?? null,
        }))

        const sortedIdx = (idx || [])
          .slice()
          .sort((a, b) => (b.year - a.year) || (b.month - a.month))

        setWallets(mappedWallets)
        setAvailableMonths(sortedIdx)

        // Rango por defecto: últimos 6 meses disponibles (o actual si no hay índice)
        if (sortedIdx.length > 0) {
          const latest = sortedIdx[0]
          const latestStr = `${latest.year}-${String(latest.month).padStart(2, "0")}`

          // buscar el sexto más antiguo dentro de los disponibles
          const upto6 = sortedIdx.slice(0, 6)
          const oldest = upto6[upto6.length - 1]
          const oldestStr = `${oldest.year}-${String(oldest.month).padStart(2, "0")}`

          setStartDate(oldestStr)
          setEndDate(latestStr)
        } else {
          const now = new Date()
          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
          setStartDate(`${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}`)
          setEndDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
        }
      } catch (e: any) {
        setError(e?.message ?? "Error cargando datos iniciales.")
      } finally {
        setLoadingIndex(false)
      }
    }

    loadBasics()
  }, [])

  // 2) Cargar meses del rango (IDs de ingesta) + transacciones vinculadas
  useEffect(() => {
    const loadRange = async () => {
      if (!startDate || !endDate) {
        setMonthsInRange([])
        setTransactions([])
        setSnapshots([])
        return
      }

      try {
        setLoadingData(true)
        setError(null)

        // filtrar índice por rango de meses (inclusive)
        const months = availableMonths
          .filter((m) => toKey(m.year, m.month) >= startDate && toKey(m.year, m.month) <= endDate)
          .slice() // copia
          .sort((a, b) => (a.year - b.year) || (a.month - b.month)) // asc para acumulados

        // obtener IDs de ingesta para esos meses
        const withIds: Array<{ year: number; month: number; ingestionId: string }> = []
        for (const m of months) {
          const mi = await getMonthlyIngestion(m.year, m.month)
          if (mi?.id) {
            withIds.push({ year: m.year, month: m.month, ingestionId: mi.id })
          }
        }

        setMonthsInRange(withIds)

        // Si no hay ingestas, vaciar
        if (withIds.length === 0) {
          setTransactions([])
          setSnapshots([])
          return
        }

        // Traer transacciones de monedero asociadas a esas ingestas
        const tx = await fetchWalletTransactionsByIngestionIds(withIds.map((x) => x.ingestionId))
        // normalizar amounts a número
        const norm = (tx || []).map((t: any) => ({
          ...t,
          amount: Number(t.amount) || 0,
        })) as WalletTransaction[]

        setTransactions(norm)
      } catch (e: any) {
        setError(e?.message ?? "Error cargando evolución.")
        setTransactions([])
        setSnapshots([])
      } finally {
        setLoadingData(false)
      }
    }

    loadRange()
  }, [startDate, endDate, availableMonths])

  // 3) Construir snapshots mensuales a partir de transacciones
  useEffect(() => {
    if (monthsInRange.length === 0) {
      setSnapshots([])
      return
    }

    // Mapas acumulados por wallet
    const runningBalance: Record<string, number> = {}
    const lastBalance: Record<string, number> = {}

    wallets.forEach((w) => {
      runningBalance[w.id] = 0 // partimos de 0, como hacía tu versión localStorage
      lastBalance[w.id] = 0
    })

    const snaps: MonthlySnapshot[] = []

    for (const m of monthsInRange) {
      // cambio del mes por wallet
      const changesByWallet: Record<string, number> = {}
      wallets.forEach((w) => (changesByWallet[w.id] = 0))

      // sumar transacciones del mes actual (por ingestionId)
      const monthTx = transactions.filter((t) => t.monthly_ingestion_id === m.ingestionId)
      for (const tx of monthTx) {
        if (changesByWallet[tx.wallet_id] === undefined) changesByWallet[tx.wallet_id] = 0
        changesByWallet[tx.wallet_id] += Number(tx.amount) || 0
      }

      // aplicar cambios y calcular snapshot por wallet
      const walletRows = wallets.map((w) => {
        const prev = lastBalance[w.id]
        const change = changesByWallet[w.id] || 0
        runningBalance[w.id] = prev + change
        lastBalance[w.id] = runningBalance[w.id]

        const changePercentage = prev !== 0 ? (change / Math.abs(prev)) * 100 : (change === 0 ? 0 : 100)

        return {
          id: w.id,
          name: w.name,
          balance: runningBalance[w.id],
          targetBalance: w.target_balance ?? null,
          change,
          changePercentage,
        }
      })

      const totalBalance = walletRows.reduce((s, r) => s + r.balance, 0)
      const totalChange = walletRows.reduce((s, r) => s + r.change, 0)

      snaps.push({
        month: m.month,
        year: m.year,
        date: toKey(m.year, m.month),
        wallets: walletRows,
        totalBalance,
        totalChange,
        ingestionId: m.ingestionId,
      })
    }

    setSnapshots(snaps)
  }, [monthsInRange, transactions, wallets])

  // Helpers
  const filteredSnapshots = useMemo(() => {
    let list = snapshots
    if (startDate && endDate) {
      list = list.filter((s) => s.date >= startDate && s.date <= endDate)
    }
    // orden: más reciente primero
    return list.slice().sort((a, b) => (b.year - a.year) || (b.month - a.month))
  }, [snapshots, startDate, endDate])

  const getWalletProgress = (balance: number, target?: number | null) => {
    if (!target || target <= 0) return 0
    return Math.min((balance / target) * 100, 100)
  }

  const formatMonthYear = (month: number, year: number) =>
    new Date(year, month - 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Evolución de Monederos</h1>
          <p className="text-muted-foreground">Cambios mensuales según tus ingestas</p>
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
          <CardDescription>
            El rango se basa en los meses con <em>ingestas</em> existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div className="space-y-2">
            <Label>Desde</Label>
            <Input
              type="month"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-48"
              disabled={loadingIndex || loadingData}
            />
          </div>

          <div className="space-y-2">
            <Label>Hasta</Label>
            <Input
              type="month"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-48"
              disabled={loadingIndex || loadingData}
            />
          </div>

          <div className="space-y-2">
            <Label>Monedero</Label>
            <Select value={selectedWallet} onValueChange={setSelectedWallet} disabled={loadingIndex || loadingData}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecciona monedero" />
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
      {loadingData ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">Cargando evolución...</p>
          </CardContent>
        </Card>
      ) : filteredSnapshots.length > 0 ? (
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
                      Total mov.: €{snapshot.totalChange.toFixed(2)}
                      {snapshot.totalChange !== 0 && (
                        <span className={`ml-2 ${snapshot.totalChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ({snapshot.totalChange >= 0 ? "+" : ""}€{snapshot.totalChange.toFixed(2)})
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {snapshot.wallets
                      .filter((w) => selectedWallet === "all" || w.id === selectedWallet)
                      .map((w) => {
                        const progress = getWalletProgress(w.balance, w.targetBalance)
                        return (
                          <div key={w.id} className="p-3 border rounded-lg bg-muted">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{w.name}</span>
                              {w.change !== 0 && (
                                <div className={`flex items-center text-xs ${w.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {w.change >= 0 ? (
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                  )}
                                  {w.change >= 0 ? "+" : ""}€{w.change.toFixed(2)}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">€{w.balance.toFixed(2)}</span>
                                {typeof w.targetBalance === "number" && (
                                  <span className="text-xs text-muted-foreground">/ €{Number(w.targetBalance).toFixed(2)}</span>
                                )}
                              </div>

                              {typeof w.targetBalance === "number" && (
                                <div className="space-y-1">
                                  <Progress value={progress} className="h-1.5" />
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>{progress.toFixed(1)}% del objetivo</span>
                                    <span>
                                      {w.balance >= (w.targetBalance || 0)
                                        ? "✅ Completado"
                                        : `Faltan €${((w.targetBalance || 0) - w.balance).toFixed(2)}`}
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
              <CardDescription>Según los meses del rango seleccionado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(() => {
                  const first = filteredSnapshots[filteredSnapshots.length - 1]
                  const last = filteredSnapshots[0]
                  const totalGrowth = last ? last.totalBalance - (first?.totalBalance || 0) : 0
                  const growthPercentage = first?.totalBalance ? (totalGrowth / (first.totalBalance || 1)) * 100 : 0

                  return (
                    <>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold">€{last?.totalBalance.toFixed(2) || "0.00"}</div>
                        <div className="text-sm text-muted-foreground">Balance Acumulado (simulación)</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className={`text-2xl font-bold ${totalGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {totalGrowth >= 0 ? "+" : ""}€{totalGrowth.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">Crecimiento Total</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className={`text-2xl font-bold ${growthPercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {growthPercentage >= 0 ? "+" : ""}{growthPercentage.toFixed(1)}%
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
                : "Realiza algunas ingestas mensuales para ver la evolución de tus monederos."}
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

// --- Helpers locales ---
function toKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`
}
