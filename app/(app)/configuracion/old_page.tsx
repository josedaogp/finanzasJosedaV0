"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Save, Settings, Percent, DollarSign, AlertTriangle, Plus, Trash2, TrendingUp } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

export default function ConfiguracionPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [distributionRules, setDistributionRules] = useState<DistributionRule[]>([])
  const [testAmount, setTestAmount] = useState<number>(1000)
  const [isAddWalletDialogOpen, setIsAddWalletDialogOpen] = useState(false)
  const [selectedWalletToAdd, setSelectedWalletToAdd] = useState<string>("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const handleIngestaCompleted = () => {
      loadData() // Recargar datos
    }

    window.addEventListener("ingestaCompleted", handleIngestaCompleted)
    return () => window.removeEventListener("ingestaCompleted", handleIngestaCompleted)
  }, [])

  const loadData = () => {
    const savedWallets = localStorage.getItem("wallets")
    const savedDistribution = localStorage.getItem("distributionRules")

    if (savedWallets) {
      setWallets(JSON.parse(savedWallets))
    }

    if (savedDistribution) {
      setDistributionRules(JSON.parse(savedDistribution))
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
  }

  const updateRule = (walletId: string, field: keyof DistributionRule, value: any) => {
    setDistributionRules((prev) =>
      prev.map((rule) => (rule.walletId === walletId ? { ...rule, [field]: value } : rule)),
    )
  }

  const addRule = () => {
    if (!selectedWalletToAdd) {
      alert("Selecciona un monedero")
      return
    }

    const newRule: DistributionRule = {
      walletId: selectedWalletToAdd,
      type: "percentage",
      value: 0,
      priority: distributionRules.length + 1,
    }
    setDistributionRules([...distributionRules, newRule])
    setSelectedWalletToAdd("")
    setIsAddWalletDialogOpen(false)
  }

  const removeRule = (walletId: string) => {
    setDistributionRules((prev) => prev.filter((rule) => rule.walletId !== walletId))
  }

  const calculateDistribution = (amount: number) => {
    const sortedRules = [...distributionRules].sort((a, b) => a.priority - b.priority)
    const distribution: { [walletId: string]: number } = {}
    let remainingAmount = amount

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

  const getTotalPercentage = () => {
    return distributionRules.filter((rule) => rule.type === "percentage").reduce((sum, rule) => sum + rule.value, 0)
  }

  const getTotalFixed = () => {
    return distributionRules.filter((rule) => rule.type === "fixed").reduce((sum, rule) => sum + rule.value, 0)
  }

  const getDistributionValidation = () => {
    const activeRules = distributionRules.filter((rule) => rule.value > 0)
    if (activeRules.length === 0) {
      return { isValid: true, message: "" }
    }

    const totalPercentage = activeRules
      .filter((rule) => rule.type === "percentage")
      .reduce((sum, rule) => sum + rule.value, 0)

    const hasFixedRules = activeRules.some((rule) => rule.type === "fixed")

    if (hasFixedRules) {
      return {
        isValid: totalPercentage <= 100,
        message:
          totalPercentage > 100
            ? `Los porcentajes no pueden superar 100% cuando hay cantidades fijas. Actualmente: ${totalPercentage.toFixed(1)}%`
            : "",
      }
    }

    const difference = Math.abs(totalPercentage - 100)
    if (difference > 0.01) {
      return {
        isValid: false,
        message: `La distribución debe sumar exactamente 100%. Actualmente suma ${totalPercentage.toFixed(1)}% (${totalPercentage > 100 ? "sobran" : "faltan"} ${Math.abs(totalPercentage - 100).toFixed(1)}%)`,
      }
    }

    return { isValid: true, message: "" }
  }

  const saveConfiguration = () => {
    const validation = getDistributionValidation()
    if (!validation.isValid) {
      alert(validation.message)
      return
    }

    localStorage.setItem("distributionRules", JSON.stringify(distributionRules))

    // También actualizar el formato legacy para compatibilidad
    const legacyDistribution: { [walletId: string]: number } = {}
    const testDistribution = calculateDistribution(100) // Base 100 para porcentajes

    Object.entries(testDistribution).forEach(([walletId, amount]) => {
      legacyDistribution[walletId] = (amount / 100) * 100 // Convertir a porcentaje
    })

    localStorage.setItem("surplusDistribution", JSON.stringify(legacyDistribution))

    alert("Configuración guardada correctamente")
  }

  const testDistribution = calculateDistribution(testAmount)
  const totalPercentage = getTotalPercentage()
  const totalFixed = getTotalFixed()
  const validation = getDistributionValidation()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuración de Distribución</h1>
          <p className="text-muted-foreground">Configura cómo se distribuye el bote mensual entre monederos</p>
        </div>
        <Button onClick={saveConfiguration} disabled={!validation.isValid}>
          <Save className="mr-2 h-4 w-4" />
          Guardar Configuración
          {!validation.isValid && " (Corrige la distribución)"}
        </Button>
      </div>

      {/* Explicación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cómo Funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Cantidades Fijas:</strong> Se asignan primero, en orden de prioridad. Si no hay suficiente dinero,
              se asigna lo que quede.
            </p>
            <p>
              <strong>Porcentajes:</strong> Se aplican sobre el dinero restante después de las cantidades fijas.
            </p>
            <p>
              <strong>Prioridad:</strong> Determina el orden de asignación. Menor número = mayor prioridad.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reglas de distribución */}
      <Card>
        <CardHeader>
          <CardTitle>Reglas de Distribución</CardTitle>
          <CardDescription>Define cómo se reparte el bote mensual entre tus monederos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {distributionRules
            .sort((a, b) => a.priority - b.priority)
            .map((rule) => {
              const wallet = wallets.find((w) => w.id === rule.walletId)
              if (!wallet) return null

              return (
                <div key={rule.walletId} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{wallet.name}</span>
                      <Badge variant="outline">Prioridad {rule.priority}</Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => removeRule(rule.walletId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={rule.type}
                        onValueChange={(value: "percentage" | "fixed") => updateRule(rule.walletId, "type", value)}
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
                        onChange={(e) => updateRule(rule.walletId, "value", Number.parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <Label>Prioridad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={rule.priority}
                        onChange={(e) => updateRule(rule.walletId, "priority", Number.parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="text-sm text-muted-foreground">
                        Saldo actual: €{wallet.currentBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

          {distributionRules.length < wallets.length && (
            <Dialog open={isAddWalletDialogOpen} onOpenChange={setIsAddWalletDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full bg-transparent">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Monedero a Distribución
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Seleccionar Monedero</DialogTitle>
                  <DialogDescription>
                    Elige qué monedero quieres agregar a la distribución del bote mensual
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="wallet-select">Monedero</Label>
                  <Select value={selectedWalletToAdd} onValueChange={setSelectedWalletToAdd}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar monedero" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets
                        .filter((wallet) => !distributionRules.some((rule) => rule.walletId === wallet.id))
                        .map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.id}>
                            {wallet.name} (€{wallet.currentBalance.toFixed(2)})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button onClick={addRule} disabled={!selectedWalletToAdd}>
                    Agregar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {(() => {
        const validation = getDistributionValidation()
        const activeRules = distributionRules.filter((rule) => rule.value > 0)

        if (activeRules.length === 0) {
          return (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                💡 Agrega monederos y configura sus porcentajes para distribuir el bote mensual
              </AlertDescription>
            </Alert>
          )
        }

        if (!validation.isValid) {
          return (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>⚠️ {validation.message}</AlertDescription>
            </Alert>
          )
        }

        return (
          <Alert className="border-green-200 bg-green-50">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ Distribución configurada correctamente (100%)
            </AlertDescription>
          </Alert>
        )
      })()}

      {/* Simulador */}
      <Card>
        <CardHeader>
          <CardTitle>Simulador de Distribución</CardTitle>
          <CardDescription>Prueba cómo se distribuiría un bote mensual específico</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Monto a distribuir:</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={testAmount}
              onChange={(e) => setTestAmount(Number.parseFloat(e.target.value) || 0)}
              className="w-32"
            />
            <span className="text-muted-foreground">€</span>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Distribución resultante:</h4>
            {Object.entries(testDistribution).map(([walletId, amount]) => {
              const wallet = wallets.find((w) => w.id === walletId)
              const percentage = testAmount > 0 ? (amount / testAmount) * 100 : 0

              return (
                <div key={walletId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{wallet?.name}</span>
                    <Badge variant="secondary">{percentage.toFixed(1)}%</Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">€{amount.toFixed(2)}</div>
                  </div>
                </div>
              )
            })}

            <div className="flex justify-between items-center pt-2 border-t font-medium">
              <span>Total distribuido:</span>
              <span>
                €
                {Object.values(testDistribution)
                  .reduce((sum, amount) => sum + amount, 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
