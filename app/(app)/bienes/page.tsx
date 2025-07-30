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
import { Plus, Edit, Trash2, Building2 } from "lucide-react"

import { Asset } from "@/types/models"
import { fetchAssets, createAsset, updateAsset, deleteAsset } from "@/services/assetService"
import { useRequireAuth } from "@/hooks/useRequireAuth"

// Opcional: puedes tener este tipo si tienes la tabla asset_types
interface AssetType {
  id: number
  name: string
  icon?: React.ElementType // Si luego quieres poner iconos por tipo, aquí
}

export default function BienesPage() {
  const session = useRequireAuth()
  if (!session) return null

  const [assets, setAssets] = useState<Asset[]>([])
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [formData, setFormData] = useState<Partial<Asset>>({
    name: "",
    asset_type_id: undefined,
    current_balance: 0,
  })

  // Carga inicial de assets y assetTypes
  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      setError(null)
      try {
        // Opcional: carga tipos de asset de la BBDD (asset_types)
        const typesData = await fetchAssetTypes() // si tienes el service
        setAssetTypes(typesData)
        // Carga los bienes del usuario
        const assetsData = await fetchAssets(session!.user.id)
        setAssets(assetsData)
      } catch (err: any) {
        setError(err.message || "Error al cargar los bienes")
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [session.user.id])

  // Opcional: service para tipos de asset (asset_types)
  async function fetchAssetTypes(): Promise<AssetType[]> {
    // Si tienes un service global, usa ese
    // Si no, aquí te pongo la query básica:
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase
      .from("asset_types")
      .select("*")
      .order("id")
    if (error) throw new Error(error.message)
    return data as AssetType[]
  }

  // Helpers
  const getTypeLabel = (type_id: number | null | undefined) => {
    const type = assetTypes.find((t) => t.id === type_id)
    return type ? type.name : "-"
  }

  const getTotalBalance = () => {
    return assets.reduce((sum, asset) => sum + Number(asset.current_balance), 0)
  }

  // Dialog open/close helpers
  const openDialog = (asset?: Asset) => {
    if (asset) {
      setEditingAsset(asset)
      setFormData({
        name: asset.name,
        asset_type_id: asset.asset_type_id ?? undefined,
        current_balance: Number(asset.current_balance) ?? 0,
      })
    } else {
      setEditingAsset(null)
      setFormData({
        name: "",
        asset_type_id: assetTypes[0]?.id ?? undefined,
        current_balance: 0,
      })
    }
    setIsDialogOpen(true)
  }

  // Guardar asset
  const handleSave = async () => {
    if (!formData.name?.trim()) {
      alert("El nombre es obligatorio")
      return
    }
    if (!formData.asset_type_id) {
      alert("Selecciona el tipo de bien")
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (editingAsset) {
        const updated = await updateAsset(editingAsset.id, {
          name: formData.name.trim(),
          asset_type_id: Number(formData.asset_type_id),
          current_balance: Number(formData.current_balance),
        })
        setAssets((prev) =>
          prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
        )
      } else {
        const payload = {
          name: formData.name!.trim(),
          asset_type_id: Number(formData.asset_type_id),
          current_balance: Number(formData.current_balance),
          user_id: session.user.id,
        }
        await createAsset(payload)
        // Recargar lista entera por seguridad
        const assetsData = await fetchAssets(session.user.id)
        setAssets(assetsData)
      }
      setIsDialogOpen(false)
    } catch (err: any) {
      setError(err.message || "Error al guardar el bien")
    } finally {
      setLoading(false)
    }
  }

  // Eliminar asset
  const handleDelete = async (assetId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este bien?")) return
    setLoading(true)
    setError(null)
    try {
      await deleteAsset(assetId)
      setAssets((prev) => prev.filter((a) => a.id !== assetId))
    } catch (err: any) {
      setError(err.message || "Error al eliminar el bien")
    } finally {
      setLoading(false)
    }
  }

  // Render
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
                  value={formData.name || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre del bien"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset_type_id">Tipo de bien</Label>
                <Select
                  value={formData.asset_type_id ? formData.asset_type_id.toString() : ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      asset_type_id: Number(value)
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_balance">Saldo actual</Label>
                <Input
                  id="current_balance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.current_balance ?? 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      current_balance: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleSave} disabled={loading}>
                {editingAsset ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">€{getTotalBalance().toFixed(2)}</div>
          <p className="text-muted-foreground">Valor total de todos los bienes</p>
        </CardContent>
      </Card>

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
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(asset.asset_type_id)}</Badge>
                  </TableCell>
                  <TableCell>€{Number(asset.current_balance).toFixed(2)}</TableCell>
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
              ))}
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
      {error && <div className="text-red-500 text-center">{error}</div>}
    </div>
  )
}
