"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { AuthWidget } from "@/components/AuthWidget"
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

import { fetchCategories, createCategory, updateCategory, deleteCategory } from "@/services/categoryService"
import { fetchWallets } from "@/services/walletService"
import { fetchCategoryTypes } from "@/services/categoryTypesService"
import { CategoryType, Wallet } from "@/types/models"
import { Category, CategoryWithType } from "@/types/category"
import { useRequireAuth } from "@/hooks/useRequireAuth"

// ===========================
// Página de gestión de categorías de gasto
// ===========================

export default function CategoriasPage() {

  const session = useRequireAuth()
  if (!session) return null
    
  // Estados principales
  const [categories, setCategories] = useState<CategoryWithType[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [categoryTypes, setCategoryTypes] = useState<CategoryType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estado de formulario y diálogo
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryWithType | null>(null)
  const [formData, setFormData] = useState<Partial<Category>>({
    name: "",
    category_type_id: undefined,
    monthly_budget: 0,
    annual_budget: undefined,
    active: true,
    wallet_id: undefined,
  })

  // Carga inicial de datos
  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      try {
        const [cats, types, ws] = await Promise.all([
          fetchCategories(),
          fetchCategoryTypes(),
          fetchWallets(),
        ])
        setCategories(cats)
        setCategoryTypes(types)
        setWallets(ws)
      } catch (err: any) {
        setError(err.message || "Error al cargar datos")
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  // Helpers para mostrar nombres y labels
  const getTypeLabel = (type_id: number | null | undefined) => {
    const type = categoryTypes.find((t) => t.id === type_id)
    return type ? type.name : "-"
  }

  const getWalletName = (wallet_id?: string | null) => {
    if (!wallet_id) return "-"
    const wallet = wallets.find((w) => w.id === wallet_id)
    return wallet?.name || "Monedero no encontrado"
  }

  // Abrir el diálogo de creación/edición
  const openDialog = (category?: CategoryWithType) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        category_type_id: category.category_type_id ?? undefined,
        monthly_budget: Number(category.monthly_budget) ?? 0,
        annual_budget: category.annual_budget ?? undefined,
        active: category.active,
        wallet_id: category.wallet_id ?? undefined,
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: "",
        category_type_id: categoryTypes[0]?.id ?? undefined,
        monthly_budget: 0,
        annual_budget: undefined,
        active: true,
        wallet_id: undefined,
      })
    }
    setIsDialogOpen(true)
  }

  // Guardar (crear o actualizar)
  const handleSave = async () => {
    if (!formData.name?.trim()) {
      alert("El nombre es obligatorio")
      return
    }
    if (!formData.category_type_id) {
      alert("Selecciona el tipo de categoría")
      return
    }
    if (typeof formData.monthly_budget !== "number" || isNaN(formData.monthly_budget)) {
      alert("Presupuesto mensual no válido")
      return
    }
    setLoading(true)
    try {
      if (editingCategory) {
        const updated = await updateCategory(editingCategory.id, {
          ...formData,
          name: formData.name.trim(),
          // Cast to number/undefined as needed
          monthly_budget: Number(formData.monthly_budget),
          annual_budget: formData.annual_budget !== undefined && formData.annual_budget !== null
            ? Number(formData.annual_budget)
            : null,
        })
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === updated.id
              ? { ...cat, ...updated }
              : cat
          )
        )
      } else {
        const payload = {
          name: formData.name!.trim(),
          category_type_id: formData.category_type_id!,
          monthly_budget: Number(formData.monthly_budget),
          annual_budget:
            formData.annual_budget !== undefined && formData.annual_budget !== null
              ? Number(formData.annual_budget)
              : null,
          active: formData.active ?? true,
          wallet_id: formData.wallet_id ?? null,
          user_id: session.user.id, // <-- AÑADE ESTO SIEMPRE
        }

        await createCategory(payload)
 
        // Recarga la lista para incluir la relación con tipos (más robusto)
        const cats = await fetchCategories()
        setCategories(cats)
      }
      setIsDialogOpen(false)
      setError(null)
    } catch (err: any) {
      setError(err.message || "Error al guardar la categoría")
    } finally {
      setLoading(false)
    }
  }

  // Eliminar
  const handleDelete = async (categoryId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta categoría?")) return
    setLoading(true)
    try {
      await deleteCategory(categoryId)
      setCategories((prev) => prev.filter((cat) => cat.id !== categoryId))
    } catch (err: any) {
      setError(err.message || "Error al eliminar la categoría")
    } finally {
      setLoading(false)
    }
  }

  // Activar/desactivar categoría (toggle)
  const toggleActive = async (category: CategoryWithType) => {
    setLoading(true)
    try {
      const updated = await updateCategory(category.id, { active: !category.active })
      setCategories((prev) =>
        prev.map((cat) => (cat.id === updated.id ? { ...cat, ...updated } : cat))
      )
    } catch (err: any) {
      setError(err.message || "Error al actualizar el estado")
    } finally {
      setLoading(false)
    }
  }

  // ===========================
  // Render
  // ===========================
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
                  value={formData.name || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre de la categoría"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de categoría</Label>
                <Select
                  value={formData.category_type_id?.toString() ?? ""}
                  onValueChange={(value) => setFormData((prev) => ({
                    ...prev,
                    category_type_id: Number(value)
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
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
                  value={formData.monthly_budget ?? 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      monthly_budget: Number.parseFloat(e.target.value) || 0
                    }))
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
                  value={formData.annual_budget ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      annual_budget: e.target.value === "" ? undefined : Number.parseFloat(e.target.value)
                    }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="walletId">Monedero asociado (opcional)</Label>
                <Select
                  value={formData.wallet_id ?? ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      wallet_id: value === "" ? undefined : value
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar monedero" />
                  </SelectTrigger>
                  <Select
  value={formData.wallet_id ?? "none"}
  onValueChange={(value) =>
    setFormData((prev) => ({
      ...prev,
      wallet_id: value === "none" ? undefined : value
    }))
  }
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

                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={!!formData.active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      active: checked
                    }))
                  }
                />
                <Label htmlFor="active">Categoría activa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave} disabled={loading}>
                {editingCategory ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
            {error && (
              <div className="text-red-500 text-sm mt-2">{error}</div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-10 text-center">Cargando...</div>
      ) : (
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
                      <Badge variant="outline">{getTypeLabel(category.category_type_id)}</Badge>
                    </TableCell>
                    <TableCell>€{Number(category.monthly_budget).toFixed(2)}</TableCell>
                    <TableCell>{getWalletName(category.wallet_id)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={category.active}
                          onCheckedChange={() => toggleActive(category)}
                        />
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
      )}

      {error && (
        <div className="text-red-500 text-center">{error}</div>
      )}
    </div>
  )
}
