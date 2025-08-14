"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, TrendingUp, TrendingDown, Building2 } from "lucide-react"

import { useRequireAuth } from "@/hooks/useRequireAuth"
import { fetchWallets } from "@/services/walletService"
import { fetchAssets } from "@/services/assetService"
import { getMonthlyIngestion, getMonthlyIngestionsIndex } from "@/services/ingestionService"
import { EnrichedMonthlyIngestion } from "@/types/models"

type Wallet = {
  id: string
  name: string
  current_balance: number
  target_balance?: number | null
}

type Asset = {
  id: string
  name: string
  current_balance: number
  asset_types?: { name: string } | null
  type?: string | null
}

export default function ResumenPage() {
  const session = useRequireAuth()
  if (!session) return null

  const [selectedDate, setSelectedDate] = useState<string>("") // "YYYY-MM"
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [monthlyIngestions, setMonthlyIngestions] = useState<EnrichedMonthlyIngestion[]>([])
  const [availableMonths, setAvailableMonths] = useState<{ year: number; month: number }[]>([])
  const [loadingIndex, setLoadingIndex] = useState<boolean>(true)
  const [loadingMonths, setLoadingMonths] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadBasics = async () => {
      try {
        setLoadingIndex(true)
        setError(null)

        const [ws, as, idx] = await Promise.all([
          fetchWallets(),
          fetchAssets(session.user.id),
          getMonthlyIngestionsIndex(),
        ])

        const mappedWallets: Wallet[] = (ws || []).map((w: any) => ({
          id: w.id,
          name: w.name,
          current_balance: Number(w.current_balance ?? w.currentBalance ?? 0),
          target_balance: w.target_balance ?? w.targetBalance ?? null,
        }))

        const mappedAssets: Asset[] = (as || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          current_balance: Number(a.current_balance ?? a.currentBalance ?? 0),
          asset_types: a.asset_types ?? null,
          type: a.type ?? null,
        }))

        const sortedIdx = (idx || [])
          .slice()
          .sort((a, b) => (b.year - a.year) || (b.month - a.month))

        setWallets(mappedWallets)
        setAssets(mappedAssets)
        setAvailableMonths(sortedIdx)

        if (sortedIdx.length > 0) {
          const y = sortedIdx[0].year
          const m = String(sortedIdx[0].month).padStart(2, "0")
          setSelectedDate(`${y}-${m}`)
        } else {
          const now = new Date()
          setSelectedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
        }
      } catch (e: any) {
        setError(e?.message ?? "Error cargando datos iniciales.")
      } finally {
        setLoadingIndex(false)
      }
    }

    loadBasics()
  }, [session.user.id])

  useEffect(() => {
    const loadMonths = async () => {
      if (!selectedDate) {
        setMonthlyIngestions([])
        return
      }
      try {
        setLoadingMonths(true)
        setError(null)

        const [selY, selM] = selectedDate.split("-").map((x) => Number(x))
        const upToSelected = availableMonths.filter(
          (r) => (r.year < selY) || (r.year === selY && r.month <= selM)
        )
        const last6 = upToSelected.slice(0, 6)

        const results = await Promise.all(
          last6.map((r) => getMonthlyIngestion(r.year, r.month))
        )

        const ing = results.filter(Boolean) as EnrichedMonthlyIngestion[]
        ing.sort((a, b) => (b.year - a.year) || (b.month - a.month))

        setMonthlyIngestions(ing)
      } catch (e: any) {
        setError(e?.message ?? "Error cargando ingestas del rango.")
        setMonthlyIngestions([])
      } finally {
        setLoadingMonths(false)
      }
    }

    loadMonths()
  }, [selectedDate, availableMonths])

  const totalWalletBalance = useMemo(
    () => wallets.reduce((sum, w) => sum + (Number(w.current_balance) || 0), 0),
    [wallets]
  )
  const totalAssetBalance = useMemo(
    () => assets.reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0),
    [assets]
  )

  // Diferencia que debe ser 0: monederos - bienes
  const difference = useMemo(() => totalWalletBalance - totalAssetBalance, [totalWalletBalance, totalAssetBalance])
  const isBalanced = Math.abs(difference) < 0.005 // tolerancia céntimos por redondeos

  const getWalletProgress = (current?: number | null, target?: number | null) => {
    const c = Number(current || 0)
    const t = Number(target || 0)
    if (!t || t <= 0) return 0
    return Math.min((c / t) * 100, 100)
  }

  const evolution = useMemo(() => {
    return monthlyIngestions.map((mi) => {
      const totalIncome = (mi.incomes || []).reduce((s, i: any) => s + (Number(i.amount) || 0), 0)
      const totalExpenses = (mi.expenses || []).reduce((s, e: any) => s + (Number(e.amount) || 0), 0)
      const surplus = totalIncome - totalExpenses
      return {
        id: mi.id,
        year: mi.year,
        month: mi.month,
        totalIncome,
        totalExpenses,
        surplus,
      }
    })
  }, [monthlyIngestions])

  const selectedLabel = useMemo(() => {
    if (!selectedDate) return ""
    try {
      return new Date(`${selectedDate}-01`).toLocaleDateString("es-ES", { month: "long", year: "numeric" })
    } catch {
      return selectedDate
    }
  }, [selectedDate])

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
          <CardDescription>Selecciona la fecha para ver la evolución histórica (no afecta a saldos actuales)</CardDescription>
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
                disabled={loadingIndex}
              />
              <p className="text-xs text-muted-foreground">
                Este selector solo filtra la sección <strong>“Evolución Mensual”</strong>.
              </p>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">⚠️ {error}</p>}
        </CardContent>
      </Card>

      {/* Resumen general */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Monederos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monederos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalWalletBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{wallets.length} monederos activos</p>
          </CardContent>
        </Card>

        {/* Total Bienes (Patrimonio Total) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bienes (Patrimonio Total)</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalAssetBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{assets.length} bienes registrados</p>
          </CardContent>
        </Card>

        {/* Diferencia Monederos − Bienes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diferencia (Monederos − Bienes)</CardTitle>
            {isBalanced ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isBalanced ? "text-green-600" : "text-red-600"}`}>
              {difference >= 0 ? "+" : ""}€{difference.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Debe ser exactamente 0 si todo está conciliado.</p>
          </CardContent>
        </Card>
      </div>

      {/* Mensaje de conciliación / alerta */}
      {isBalanced ? (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            ✅ Todo cuadra: <strong>Monederos = Bienes</strong>. No hay descuadres en el patrimonio.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            ⚠️ Descuadre detectado: la diferencia Monederos − Bienes es{" "}
            <strong>{difference >= 0 ? "+" : ""}€{difference.toFixed(2)}</strong>. Revisa que los movimientos y saldos estén
            correctamente registrados.
          </AlertDescription>
        </Alert>
      )}

      {/* Estado de monederos */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Monederos</CardTitle>
          <CardDescription>
            Saldos y progreso hacia objetivos al {selectedLabel || "mes seleccionado"}
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
              {wallets.map((wallet) => {
                const current = Number(wallet.current_balance || 0)
                const target = wallet.target_balance ?? null
                const diff = target ? current - Number(target) : 0
                const progress = getWalletProgress(current, target)

                return (
                  <TableRow key={wallet.id}>
                    <TableCell className="font-medium">{wallet.name}</TableCell>
                    <TableCell>€{current.toFixed(2)}</TableCell>
                    <TableCell>{target ? `€${Number(target).toFixed(2)}` : "-"}</TableCell>
                    <TableCell>
                      {target !== null && target !== undefined && (
                        <div className={`flex items-center ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {diff >= 0 ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          €{Math.abs(diff).toFixed(2)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {target ? (
                        <div className="flex items-center space-x-2">
                          <Progress value={progress} className="w-20 h-2" />
                          <span className="text-sm">{progress.toFixed(0)}%</span>
                        </div>
                      ) : (
                        "-"
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
            Saldos de activos y cuentas al {selectedLabel || "mes seleccionado"}
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
              {assets.map((asset) => {
                const current = Number(asset.current_balance || 0)
                const total = totalAssetBalance
                const percentage = total > 0 ? (current / total) * 100 : 0
                const typeLabel =
                  asset.asset_types?.name ??
                  (asset.type ? String(asset.type).replace(/_/g, " ") : "—")

                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabel}</Badge>
                    </TableCell>
                    <TableCell>€{current.toFixed(2)}</TableCell>
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
          {loadingMonths ? (
            <p className="text-sm text-muted-foreground">Cargando meses...</p>
          ) : monthlyIngestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ingestas previas para mostrar.</p>
          ) : (
            <div className="space-y-4">
              {evolution.map((row) => {
                const label = `${String(row.month).padStart(2, "0")}/${row.year}`
                const surplusPositive = row.surplus >= 0
                return (
                  <div key={row.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-sm text-muted-foreground">
                        Ingresos: €{row.totalIncome.toFixed(2)} | Gastos: €{row.totalExpenses.toFixed(2)}
                      </div>
                    </div>
                    <div className={`text-right ${surplusPositive ? "text-green-600" : "text-red-600"}`}>
                      <div className="font-medium">
                        {surplusPositive ? "+" : ""}€{row.surplus.toFixed(2)}
                      </div>
                      <div className="text-sm">{surplusPositive ? "Sobrante" : "Déficit"}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
