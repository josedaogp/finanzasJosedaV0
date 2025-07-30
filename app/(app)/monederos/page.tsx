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

import { Wallet } from "@/types/models"
import { fetchWallets, createWallet, updateWallet, deleteWallet } from "@/services/walletService"
import { useRequireAuth } from "@/hooks/useRequireAuth"

export default function MonederosPage() {
  const session = useRequireAuth()
  if (!session) return null

  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null)
  const [formData, setFormData] = useState<Partial<Wallet>>({
    name: "",
    current_balance: 0,
    target_balance: undefined,
  })

  // Carga de datos inicial
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const ws = await fetchWallets(session!.user.id)
        setWallets(ws)
      } catch (err: any) {
        setError(err.message || "Error al cargar monederos")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [session.user.id])

  // Helpers
  const calculateProgress = (current?: number, target?: number | null) => {
    if (!target || target === 0) return 0
    return Math.min(((current ?? 0) / target) * 100, 100)
  }

  // Dialog handlers
  const openDialog = (wallet?: Wallet) => {
    if (wallet) {
      setEditingWallet(wallet)
      setFormData({
        name: wallet.name,
        current_balance: Number(wallet.current_balance) ?? 0,
        target_balance: wallet.target_balance ?? undefined,
      })
    } else {
      setEditingWallet(null)
      setFormData({
        name: "",
        current_balance: 0,
        target_balance: undefined,
      })
    }
    setIsDialogOpen(true)
  }

  // Guardar monedero (nuevo o editado)
  const handleSave = async () => {
    if (!formData.name?.trim()) {
      alert("El nombre es obligatorio")
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (editingWallet) {
        const updated = await updateWallet(editingWallet.id, {
          name: formData.name.trim(),
          current_balance: Number(formData.current_balance),
          target_balance:
            formData.target_balance !== undefined && formData.target_balance !== null
              ? Number(formData.target_balance)
              : null,
        })
        setWallets((prev) =>
          prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w))
        )
      } else {
        const payload = {
          name: formData.name!.trim(),
          current_balance: Number(formData.current_balance),
          target_balance:
            formData.target_balance !== undefined && formData.target_balance !== null
              ? Number(formData.target_balance)
              : null,
          user_id: session.user.id,
        }
        await createWallet(payload)
        // Recargar la lista (para asegurarte de mostrar todos los campos calculados en BBDD)
        const ws = await fetchWallets(session.user.id)
        setWallets(ws)
      }
      setIsDialogOpen(false)
    } catch (err: any) {
      setError(err.message || "Error al guardar el monedero")
    } finally {
      setLoading(false)
    }
  }

  // Eliminar
  const handleDelete = async (walletId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este monedero?")) return
    setLoading(true)
    setError(null)
    try {
      await deleteWallet(walletId)
      setWallets((prev) => prev.filter((w) => w.id !== walletId))
    } catch (err: any) {
      setError(err.message || "Error al eliminar el monedero")
    } finally {
      setLoading(false)
    }
  }

  // Render
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
                  value={formData.name || ""}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
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
                  value={formData.current_balance ?? 0}
                  onChange={(e) =>
                    setFormData((prev: any) => ({ ...prev, current_balance: Number.parseFloat(e.target.value) || 0 }))
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
                  value={formData.target_balance ?? ""}
                  onChange={(e) =>
                    setFormData((prev: any) => ({
                      ...prev,
                      target_balance: e.target.value === "" ? undefined : Number.parseFloat(e.target.value),
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave} disabled={loading}>
                {editingWallet ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-10 text-center">Cargando...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Monederos</CardTitle>
            <CardDescription>Lista de todos tus monederos y su estado</CardDescription>
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
                  const difference =
                    wallet.target_balance !== null && wallet.target_balance !== undefined
                      ? Number(wallet.current_balance) - Number(wallet.target_balance)
                      : 0
                  const progress = calculateProgress(wallet.current_balance, wallet.target_balance)
                  return (
                    <TableRow key={wallet.id}>
                      <TableCell className="font-medium">{wallet.name}</TableCell>
                      <TableCell>€{Number(wallet.current_balance).toFixed(2)}</TableCell>
                      <TableCell>
                        {wallet.target_balance !== null && wallet.target_balance !== undefined
                          ? `€${Number(wallet.target_balance).toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {wallet.target_balance !== null && wallet.target_balance !== undefined && (
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
                        {wallet.target_balance !== null && wallet.target_balance !== undefined && (
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
      )}

      {error && <div className="text-red-500 text-center">{error}</div>}
    </div>
  )
}
