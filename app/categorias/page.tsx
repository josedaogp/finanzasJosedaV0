"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { Plus, Edit, Trash2, Tag } from "lucide-react"

interface Category {
  id: string
  name: string
  type: "gasto" | "gasto_acumulativo" | "gasto_mixto" | "gasto_acumulativo_opcional"
  monthlyBudget: number
  annualBudget?: number
  active: boolean
  walletId?: string
}

interface Wallet {
  id: string
  name: string
}

const categoryTypes = [
  { value: "gasto", label: "Gasto" },
  { value: "gasto_acumulativo", label: "Gasto Acumulativo" },
  { value: "gasto_mixto", label: "Gasto Mixto" },
  { value: "gasto_acumulativo_opcional", label: "Gasto Acumulativo Opcional" },
]

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "gasto" as Category["type"],
    monthlyBudget: 0,
    annualBudget: 0,
    active: true,
    walletId: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    const savedCategories = localStorage.getItem("categories")
    const savedWallets = localStorage.getItem("wallets")

    if (savedCategories) {
      setCategories(JSON.parse(savedCategories))
    }
    if (savedWallets) {
      setWallets(JSON.parse(savedWallets))
    }
  }

  const saveCategories = (newCategories: Category[]) => {
    localStorage.setItem("categories", JSON.stringify(newCategories))
    setCategories(newCategories)
  }

  const openDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        type: category.type,
        monthlyBudget: category.monthlyBudget,
        annualBudget: category.annualBudget || 0,
        active: category.active,
        walletId: category.walletId || "",
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: "",
        type: "gasto",
        monthlyBudget: 0,
        annualBudget: 0,
        active: true,
        walletId: "",
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("El nombre es obligatorio")
      return
    }

    const categoryData: Category = {
      id: editingCategory?.id || Date.now().toString(),
      name: formData.name.trim(),
      type: formData.type,
      monthlyBudget: formData.monthlyBudget,
      annualBudget: formData.annualBudget > 0 ? formData.annualBudget : undefined,
      active: formData.active,
      walletId: formData.walletId || undefined,
    }

    let newCategories: Category[]
    if (editingCategory) {
      newCategories = categories.map((cat) => (cat.id === editingCategory.id ? categoryData : cat))
    } else {
      newCategories = [...categories, categoryData]
    }

    saveCategories(newCategories)
    setIsDialogOpen(false)
  }

  const handleDelete = (categoryId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta categoría?")) {
      const newCategories = categories.filter((cat) => cat.id !== categoryId)
      saveCategories(newCategories)
    }
  }

  const toggleActive = (categoryId: string) => {
    const newCategories = categories.map((cat) => (cat.id === categoryId ? { ...cat, active: !cat.active } : cat))
    saveCategories(newCategories)
  }

  const getWalletName = (walletId?: string) => {
    if (!walletId) return "-"
    const wallet = wallets.find((w) => w.id === walletId)
    return wallet?.name || "Monedero no encontrado"
  }

  const getTypeLabel = (type: string) => {
    const typeObj = categoryTypes.find((t) => t.value === type)
    return typeObj?.label || type
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Categorías</h1>
          <p className="text-muted-foreground">Administra las categorías de gasto</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Categoría
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
              <DialogDescription>
                {editingCategory ? "Modifica los datos de la categoría" : "Crea una nueva categoría de gasto"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre de la categoría"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de categoría</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: Category["type"]) => setFormData((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyBudget">Presupuesto mensual</Label>
                <Input
                  id="monthlyBudget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.monthlyBudget}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, monthlyBudget: Number.parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="annualBudget">Presupuesto anual (opcional)</Label>
                <Input
                  id="annualBudget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.annualBudget}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, annualBudget: Number.parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="walletId">Monedero asociado (opcional)</Label>
                <Select
                  value={formData.walletId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, walletId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar monedero" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin monedero</SelectItem>
                    {wallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id}>
                        {wallet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, active: checked }))}
                />
                <Label htmlFor="active">Categoría activa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave}>
                {editingCategory ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
          <CardDescription>Lista de todas las categorías de gasto configuradas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Presupuesto Mensual</TableHead>
                <TableHead>Monedero</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(category.type)}</Badge>
                  </TableCell>
                  <TableCell>€{category.monthlyBudget.toFixed(2)}</TableCell>
                  <TableCell>{getWalletName(category.walletId)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch checked={category.active} onCheckedChange={() => toggleActive(category.id)} />
                      <span className="text-sm">{category.active ? "Activa" : "Inactiva"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openDialog(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {categories.length === 0 && (
            <div className="text-center py-8">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay categorías</h3>
              <p className="text-muted-foreground mb-4">Crea tu primera categoría de gasto</p>
              <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Categoría
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
