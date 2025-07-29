"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Building2, CreditCard, Banknote, TrendingUp } from "lucide-react"

interface Asset {
  id: string
  name: string
  type: "cuenta_bancaria" | "efectivo" | "inversion" | "propiedad" | "otro"
  currentBalance: number
}

const assetTypes = [
  { value: "cuenta_bancaria", label: "Cuenta Bancaria", icon: CreditCard },
  { value: "efectivo", label: "Efectivo", icon: Banknote },
  { value: "inversion", label: "Inversión", icon: TrendingUp },
  { value: "propiedad", label: "Propiedad", icon: Building2 },
  { value: "otro", label: "Otro", icon: Building2 },
]

export default function BienesPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "cuenta_bancaria" as Asset["type"],
    currentBalance: 0,
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
    const savedAssets = localStorage.getItem("assets")

    if (savedAssets) {
      setAssets(JSON.parse(savedAssets))
    } else {
      // Crear algunos bienes por defecto
      const defaultAssets: Asset[] = [
        { id: "1", name: "Cuenta Corriente", type: "cuenta_bancaria", currentBalance: 2500 },
        { id: "2", name: "Cuenta Ahorro", type: "cuenta_bancaria", currentBalance: 5000 },
        { id: "3", name: "Efectivo", type: "efectivo", currentBalance: 200 },
      ]
      setAssets(defaultAssets)
      localStorage.setItem("assets", JSON.stringify(defaultAssets))
    }
  }

  const saveAssets = (newAssets: Asset[]) => {
    localStorage.setItem("assets", JSON.stringify(newAssets))
    setAssets(newAssets)
  }

  const openDialog = (asset?: Asset) => {
    if (asset) {
      setEditingAsset(asset)
      setFormData({
        name: asset.name,
        type: asset.type,
        currentBalance: asset.currentBalance,
      })
    } else {
      setEditingAsset(null)
      setFormData({
        name: "",
        type: "cuenta_bancaria",
        currentBalance: 0,
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("El nombre es obligatorio")
      return
    }

    const assetData: Asset = {
      id: editingAsset?.id || Date.now().toString(),
      name: formData.name.trim(),
      type: formData.type,
      currentBalance: formData.currentBalance,
    }

    let newAssets: Asset[]
    if (editingAsset) {
      newAssets = assets.map((asset) => (asset.id === editingAsset.id ? assetData : asset))
    } else {
      newAssets = [...assets, assetData]
    }

    saveAssets(newAssets)
    setIsDialogOpen(false)
  }

  const handleDelete = (assetId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este bien?")) {
      const newAssets = assets.filter((asset) => asset.id !== assetId)
      saveAssets(newAssets)
    }
  }

  const getTypeInfo = (type: string) => {
    return assetTypes.find((t) => t.value === type) || assetTypes[0]
  }

  const getTotalBalance = () => {
    return assets.reduce((sum, asset) => sum + asset.currentBalance, 0)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Bienes</h1>
          <p className="text-muted-foreground">Administra tus activos y cuentas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Bien
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "Editar Bien" : "Nuevo Bien"}</DialogTitle>
              <DialogDescription>
                {editingAsset ? "Modifica los datos del bien" : "Crea un nuevo bien o activo"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del bien"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de bien</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: Asset["type"]) => setFormData((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center">
                          <type.icon className="mr-2 h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave}>
                {editingAsset ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen total */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">€{getTotalBalance().toFixed(2)}</div>
          <p className="text-muted-foreground">Valor total de todos los bienes</p>
        </CardContent>
      </Card>

      {/* Tarjetas de bienes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assets.map((asset) => {
          const typeInfo = getTypeInfo(asset.type)
          const IconComponent = typeInfo.icon

          return (
            <Card key={asset.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">{asset.name}</CardTitle>
                <IconComponent className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">€{asset.currentBalance.toFixed(2)}</div>
                  <Badge variant="outline" className="mt-2">
                    {typeInfo.label}
                  </Badge>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" size="sm" onClick={() => openDialog(asset)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(asset.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabla detallada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Bienes</CardTitle>
          <CardDescription>Vista detallada de todos los bienes y activos</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Saldo Actual</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const typeInfo = getTypeInfo(asset.type)
                const IconComponent = typeInfo.icon

                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <IconComponent className="mr-2 h-4 w-4" />
                        <Badge variant="outline">{typeInfo.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>€{asset.currentBalance.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => openDialog(asset)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(asset.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {assets.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay bienes</h3>
              <p className="text-muted-foreground mb-4">Crea tu primer bien o activo</p>
              <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Bien
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
