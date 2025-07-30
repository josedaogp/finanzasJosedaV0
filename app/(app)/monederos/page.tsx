"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Plus, Edit, Trash2, TrendingUp, TrendingDown } from "lucide-react"

interface Wallet {
  id: string
  name: string
  currentBalance: number
  targetBalance?: number
}

interface WalletTransaction {
  id: string
  walletId: string
  amount: number
  type: "income" | "expense"
  description: string
  date: string
}

export default function MonederosPage() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    currentBalance: 0,
    targetBalance: 0,
  })

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
    const savedTransactions = localStorage.getItem("walletTransactions")

    if (savedWallets) {
      setWallets(JSON.parse(savedWallets))
    } else {
      // Crear algunos monederos por defecto
      const defaultWallets: Wallet[] = [
        { id: "1", name: "Emergencias", currentBalance: 1000, targetBalance: 5000 },
        { id: "2", name: "Vacaciones", currentBalance: 500, targetBalance: 2000 },
        { id: "3", name: "Coche", currentBalance: 300, targetBalance: 1500 },
      ]
      setWallets(defaultWallets)
      localStorage.setItem("wallets", JSON.stringify(defaultWallets))
    }

    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions))
    }
  }

  const saveWallets = (newWallets: Wallet[]) => {
    localStorage.setItem("wallets", JSON.stringify(newWallets))
    setWallets(newWallets)
  }

  const openDialog = (wallet?: Wallet) => {
    if (wallet) {
      setEditingWallet(wallet)
      setFormData({
        name: wallet.name,
        currentBalance: wallet.currentBalance,
        targetBalance: wallet.targetBalance || 0,
      })
    } else {
      setEditingWallet(null)
      setFormData({
        name: "",
        currentBalance: 0,
        targetBalance: 0,
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("El nombre es obligatorio")
      return
    }

    const walletData: Wallet = {
      id: editingWallet?.id || Date.now().toString(),
      name: formData.name.trim(),
      currentBalance: formData.currentBalance,
      targetBalance: formData.targetBalance > 0 ? formData.targetBalance : undefined,
    }

    let newWallets: Wallet[]
    if (editingWallet) {
      newWallets = wallets.map((wallet) => (wallet.id === editingWallet.id ? walletData : wallet))
    } else {
      newWallets = [...wallets, walletData]
    }

    saveWallets(newWallets)
    setIsDialogOpen(false)
  }

  const handleDelete = (walletId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este monedero?")) {
      const newWallets = wallets.filter((wallet) => wallet.id !== walletId)
      saveWallets(newWallets)
    }
  }

  const getWalletTransactions = (walletId: string) => {
    return transactions.filter((t) => t.walletId === walletId)
  }

  const calculateProgress = (current: number, target?: number) => {
    if (!target || target === 0) return 0
    return Math.min((current / target) * 100, 100)
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return "bg-green-500"
    if (progress >= 75) return "bg-blue-500"
    if (progress >= 50) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Monederos</h1>
          <p className="text-muted-foreground">Administra tus monederos y fondos por objetivos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Monedero
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingWallet ? "Editar Monedero" : "Nuevo Monedero"}</DialogTitle>
              <DialogDescription>
                {editingWallet ? "Modifica los datos del monedero" : "Crea un nuevo monedero para tus objetivos"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del monedero"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentBalance">Saldo actual</Label>
                <Input
                  id="currentBalance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.currentBalance}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, currentBalance: Number.parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetBalance">Saldo objetivo (opcional)</Label>
                <Input
                  id="targetBalance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.targetBalance}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, targetBalance: Number.parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave}>
                {editingWallet ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen de monederos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wallets.map((wallet) => {
          const progress = calculateProgress(wallet.currentBalance, wallet.targetBalance)
          const walletTransactions = getWalletTransactions(wallet.id)

          return (
            <Card key={wallet.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{wallet.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">€{wallet.currentBalance.toFixed(2)}</div>
                  {wallet.targetBalance && (
                    <div className="text-sm text-muted-foreground">Objetivo: €{wallet.targetBalance.toFixed(2)}</div>
                  )}
                </div>

                {wallet.targetBalance && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <div className="text-sm text-muted-foreground">{walletTransactions.length} transacciones</div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openDialog(wallet)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(wallet.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabla detallada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Monederos</CardTitle>
          <CardDescription>Vista detallada de todos los monederos y su estado</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Saldo Actual</TableHead>
                <TableHead>Saldo Objetivo</TableHead>
                <TableHead>Diferencia</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map((wallet) => {
                const difference = wallet.targetBalance ? wallet.currentBalance - wallet.targetBalance : 0
                const progress = calculateProgress(wallet.currentBalance, wallet.targetBalance)

                return (
                  <TableRow key={wallet.id}>
                    <TableCell className="font-medium">{wallet.name}</TableCell>
                    <TableCell>€{wallet.currentBalance.toFixed(2)}</TableCell>
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
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openDialog(wallet)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(wallet.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {wallets.length === 0 && (
            <div className="text-center py-8">
              <div className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay monederos</h3>
              <p className="text-muted-foreground mb-4">Crea tu primer monedero para organizar tus fondos</p>
              <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Monedero
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
