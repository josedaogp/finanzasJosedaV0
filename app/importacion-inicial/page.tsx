"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Download, AlertTriangle, CheckCircle, Database, FileText } from "lucide-react"

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
  currentBalance: number
  targetBalance?: number
}

interface Asset {
  id: string
  name: string
  type: "cuenta_bancaria" | "efectivo" | "inversion" | "propiedad" | "otro"
  currentBalance: number
}

interface ImportData {
  categories?: Category[]
  wallets?: Wallet[]
  assets?: Asset[]
}

export default function ImportacionInicialPage() {
  const [jsonInput, setJsonInput] = useState("")
  const [activeTab, setActiveTab] = useState("import")
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    categories: number
    wallets: number
    assets: number
    errors: string[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const generateExampleJson = () => {
    const example: ImportData = {
      categories: [
        {
          id: "cat1",
          name: "Alimentación",
          type: "gasto",
          monthlyBudget: 300,
          active: true,
        },
        {
          id: "cat2",
          name: "Transporte",
          type: "gasto_acumulativo",
          monthlyBudget: 150,
          annualBudget: 1800,
          active: true,
          walletId: "wallet1",
        },
      ],
      wallets: [
        {
          id: "wallet1",
          name: "Emergencias",
          currentBalance: 1000,
          targetBalance: 5000,
        },
        {
          id: "wallet2",
          name: "Vacaciones",
          currentBalance: 500,
          targetBalance: 2000,
        },
      ],
      assets: [
        {
          id: "asset1",
          name: "Cuenta Corriente",
          type: "cuenta_bancaria",
          currentBalance: 2500,
        },
        {
          id: "asset2",
          name: "Efectivo",
          type: "efectivo",
          currentBalance: 200,
        },
      ],
    }

    setJsonInput(JSON.stringify(example, null, 2))
  }

  const exportCurrentData = () => {
    const categories = localStorage.getItem("categories")
    const wallets = localStorage.getItem("wallets")
    const assets = localStorage.getItem("assets")

    const exportData: ImportData = {}

    if (categories) exportData.categories = JSON.parse(categories)
    if (wallets) exportData.wallets = JSON.parse(wallets)
    if (assets) exportData.assets = JSON.parse(assets)

    if (Object.keys(exportData).length === 0) {
      alert("No hay datos para exportar")
      return
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `configuracion-inicial-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const validateCategory = (category: any): string[] => {
    const errors: string[] = []
    const validTypes = ["gasto", "gasto_acumulativo", "gasto_mixto", "gasto_acumulativo_opcional"]

    if (!category.id || typeof category.id !== "string") {
      errors.push("ID es requerido y debe ser string")
    }
    if (!category.name || typeof category.name !== "string") {
      errors.push("Nombre es requerido y debe ser string")
    }
    if (!category.type || !validTypes.includes(category.type)) {
      errors.push(`Tipo debe ser uno de: ${validTypes.join(", ")}`)
    }
    if (typeof category.monthlyBudget !== "number" || category.monthlyBudget < 0) {
      errors.push("monthlyBudget debe ser un número positivo")
    }
    if (typeof category.active !== "boolean") {
      errors.push("active debe ser boolean")
    }

    return errors
  }

  const validateWallet = (wallet: any): string[] => {
    const errors: string[] = []

    if (!wallet.id || typeof wallet.id !== "string") {
      errors.push("ID es requerido y debe ser string")
    }
    if (!wallet.name || typeof wallet.name !== "string") {
      errors.push("Nombre es requerido y debe ser string")
    }
    if (typeof wallet.currentBalance !== "number") {
      errors.push("currentBalance debe ser un número")
    }

    return errors
  }

  const validateAsset = (asset: any): string[] => {
    const errors: string[] = []
    const validTypes = ["cuenta_bancaria", "efectivo", "inversion", "propiedad", "otro"]

    if (!asset.id || typeof asset.id !== "string") {
      errors.push("ID es requerido y debe ser string")
    }
    if (!asset.name || typeof asset.name !== "string") {
      errors.push("Nombre es requerido y debe ser string")
    }
    if (!asset.type || !validTypes.includes(asset.type)) {
      errors.push(`Tipo debe ser uno de: ${validTypes.join(", ")}`)
    }
    if (typeof asset.currentBalance !== "number") {
      errors.push("currentBalance debe ser un número")
    }

    return errors
  }

  const importData = async () => {
    if (!jsonInput.trim()) {
      setImportResult({
        success: false,
        message: "Por favor, introduce los datos JSON",
        categories: 0,
        wallets: 0,
        assets: 0,
        errors: ["JSON vacío"],
      })
      return
    }

    setIsLoading(true)

    try {
      const data: ImportData = JSON.parse(jsonInput)
      const errors: string[] = []
      let categoriesImported = 0
      let walletsImported = 0
      let assetsImported = 0

      // Validar e importar categorías
      if (data.categories && Array.isArray(data.categories)) {
        const validCategories: Category[] = []

        for (const category of data.categories) {
          const validationErrors = validateCategory(category)
          if (validationErrors.length > 0) {
            errors.push(`Categoría ${category.id || "sin ID"}: ${validationErrors.join(", ")}`)
          } else {
            validCategories.push(category)
          }
        }

        if (validCategories.length > 0) {
          localStorage.setItem("categories", JSON.stringify(validCategories))
          categoriesImported = validCategories.length
        }
      }

      // Validar e importar monederos
      if (data.wallets && Array.isArray(data.wallets)) {
        const validWallets: Wallet[] = []

        for (const wallet of data.wallets) {
          const validationErrors = validateWallet(wallet)
          if (validationErrors.length > 0) {
            errors.push(`Monedero ${wallet.id || "sin ID"}: ${validationErrors.join(", ")}`)
          } else {
            validWallets.push(wallet)
          }
        }

        if (validWallets.length > 0) {
          localStorage.setItem("wallets", JSON.stringify(validWallets))
          walletsImported = validWallets.length
        }
      }

      // Validar e importar bienes
      if (data.assets && Array.isArray(data.assets)) {
        const validAssets: Asset[] = []

        for (const asset of data.assets) {
          const validationErrors = validateAsset(asset)
          if (validationErrors.length > 0) {
            errors.push(`Bien ${asset.id || "sin ID"}: ${validationErrors.join(", ")}`)
          } else {
            validAssets.push(asset)
          }
        }

        if (validAssets.length > 0) {
          localStorage.setItem("assets", JSON.stringify(validAssets))
          assetsImported = validAssets.length
        }
      }

      const totalImported = categoriesImported + walletsImported + assetsImported

      setImportResult({
        success: totalImported > 0,
        message:
          totalImported > 0
            ? `Importación completada: ${totalImported} elementos importados`
            : "No se importó ningún elemento",
        categories: categoriesImported,
        wallets: walletsImported,
        assets: assetsImported,
        errors,
      })

      if (totalImported > 0) {
        setJsonInput("")
        // Disparar evento para actualizar otras pantallas
        window.dispatchEvent(new CustomEvent("ingestaCompleted"))
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: "Error al procesar el JSON",
        categories: 0,
        wallets: 0,
        assets: 0,
        errors: [error instanceof Error ? error.message : "Error desconocido"],
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Importación Inicial</h1>
          <p className="text-muted-foreground">Importa categorías, monederos y bienes desde archivos JSON</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCurrentData}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Configuración Actual
          </Button>
          <Button variant="outline" onClick={generateExampleJson}>
            <FileText className="mr-2 h-4 w-4" />
            Generar Ejemplo
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="import">Importar</TabsTrigger>
          <TabsTrigger value="format">Formato</TabsTrigger>
        </TabsList>

        <TabsContent value="format" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Formato de Datos</CardTitle>
              <CardDescription>Estructura requerida para cada tipo de elemento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Categorías</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>
                    <code>id</code>: string - Identificador único
                  </p>
                  <p>
                    <code>name</code>: string - Nombre de la categoría
                  </p>
                  <p>
                    <code>type</code>: "gasto" | "gasto_acumulativo" | "gasto_mixto" | "gasto_acumulativo_opcional"
                  </p>
                  <p>
                    <code>monthlyBudget</code>: number - Presupuesto mensual
                  </p>
                  <p>
                    <code>annualBudget</code>: number (opcional) - Presupuesto anual
                  </p>
                  <p>
                    <code>active</code>: boolean - Si está activa
                  </p>
                  <p>
                    <code>walletId</code>: string (opcional) - ID del monedero asociado
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Monederos</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>
                    <code>id</code>: string - Identificador único
                  </p>
                  <p>
                    <code>name</code>: string - Nombre del monedero
                  </p>
                  <p>
                    <code>currentBalance</code>: number - Saldo actual
                  </p>
                  <p>
                    <code>targetBalance</code>: number (opcional) - Saldo objetivo
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Bienes</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>
                    <code>id</code>: string - Identificador único
                  </p>
                  <p>
                    <code>name</code>: string - Nombre del bien
                  </p>
                  <p>
                    <code>type</code>: "cuenta_bancaria" | "efectivo" | "inversion" | "propiedad" | "otro"
                  </p>
                  <p>
                    <code>currentBalance</code>: number - Saldo actual
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              <strong>Advertencia:</strong> Esta importación reemplazará completamente los datos existentes. Se
              recomienda exportar la configuración actual antes de proceder.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Datos JSON</CardTitle>
              <CardDescription>Pega aquí los datos JSON con categorías, monederos y bienes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="json-input">JSON de configuración inicial</Label>
                <Textarea
                  id="json-input"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Pega aquí el JSON con la configuración inicial..."
                  className="min-h-[400px] font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={importData} disabled={isLoading || !jsonInput.trim()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isLoading ? "Importando..." : "Importar Configuración"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Resultado de la importación */}
          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {importResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  Resultado de la Importación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className={importResult.success ? "border-green-200 bg-green-50" : ""}>
                  <AlertDescription className={importResult.success ? "text-green-800" : ""}>
                    {importResult.message}
                  </AlertDescription>
                </Alert>

                {(importResult.categories > 0 || importResult.wallets > 0 || importResult.assets > 0) && (
                  <div className="flex gap-4 flex-wrap">
                    {importResult.categories > 0 && (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        {importResult.categories} categorías
                      </Badge>
                    )}
                    {importResult.wallets > 0 && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        {importResult.wallets} monederos
                      </Badge>
                    )}
                    {importResult.assets > 0 && (
                      <Badge variant="default" className="bg-purple-100 text-purple-800">
                        {importResult.assets} bienes
                      </Badge>
                    )}
                  </div>
                )}

                {importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Errores y advertencias:</h4>
                    <ul className="text-sm space-y-1">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="text-muted-foreground">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
