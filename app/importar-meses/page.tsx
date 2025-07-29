"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, AlertTriangle, CheckCircle, Calendar, FileText } from "lucide-react"

interface MonthlyIngestion {
  id: string
  month: number
  year: number
  date: string
  expenses: { [categoryId: string]: number }
  incomes: Array<{
    id: string
    amount: number
    assetId: string
    description?: string
  }>
  categoryExpenses?: Array<{
    categoryId: string
    amount: number
    walletId?: string
  }>
  walletAdjustments: { [walletId: string]: string }
  surplusDistribution: { [walletId: string]: number }
}

export default function ImportarMesesPage() {
  const [jsonInput, setJsonInput] = useState("")
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    imported: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const generateExampleJson = () => {
    const example = [
      {
        id: "2025-1",
        month: 1,
        year: 2025,
        date: "2025-01-01",
        expenses: {
          cat1: 200.5,
          cat2: 150.0,
        },
        incomes: [
          {
            id: "inc1",
            amount: 2500.0,
            assetId: "asset1",
            description: "Salario enero",
          },
        ],
        categoryExpenses: [
          {
            categoryId: "cat1",
            amount: 200.5,
            walletId: "wallet1",
          },
        ],
        walletAdjustments: {
          cat1: "wallet1",
        },
        surplusDistribution: {
          wallet1: 50,
          wallet2: 50,
        },
      },
    ]

    setJsonInput(JSON.stringify(example, null, 2))
  }

  const exportCurrentData = () => {
    const savedIngestions = localStorage.getItem("monthlyIngestions")
    if (savedIngestions) {
      const data = JSON.parse(savedIngestions)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ingestas-mensuales-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      alert("No hay datos para exportar")
    }
  }

  const validateIngestion = (ingestion: any): string[] => {
    const errors: string[] = []

    if (!ingestion.id || typeof ingestion.id !== "string") {
      errors.push("ID es requerido y debe ser string")
    }
    if (!ingestion.month || typeof ingestion.month !== "number" || ingestion.month < 1 || ingestion.month > 12) {
      errors.push("Mes debe ser un número entre 1 y 12")
    }
    if (!ingestion.year || typeof ingestion.year !== "number") {
      errors.push("Año es requerido y debe ser número")
    }
    if (!ingestion.date || typeof ingestion.date !== "string") {
      errors.push("Fecha es requerida y debe ser string")
    }
    if (!ingestion.expenses || typeof ingestion.expenses !== "object") {
      errors.push("Expenses debe ser un objeto")
    }
    if (!Array.isArray(ingestion.incomes)) {
      errors.push("Incomes debe ser un array")
    }

    return errors
  }

  const importData = async () => {
    if (!jsonInput.trim()) {
      setImportResult({
        success: false,
        message: "Por favor, introduce los datos JSON",
        imported: 0,
        skipped: 0,
        errors: ["JSON vacío"],
      })
      return
    }

    setIsLoading(true)

    try {
      const data = JSON.parse(jsonInput)
      const ingestions = Array.isArray(data) ? data : [data]

      // Cargar datos existentes
      const savedIngestions = localStorage.getItem("monthlyIngestions")
      const existingIngestions: MonthlyIngestion[] = savedIngestions ? JSON.parse(savedIngestions) : []

      let imported = 0
      let skipped = 0
      const errors: string[] = []

      for (const ingestion of ingestions) {
        // Validar estructura
        const validationErrors = validateIngestion(ingestion)
        if (validationErrors.length > 0) {
          errors.push(`Ingesta ${ingestion.id || "sin ID"}: ${validationErrors.join(", ")}`)
          continue
        }

        // Verificar si ya existe
        const exists = existingIngestions.some(
          (existing) => existing.month === ingestion.month && existing.year === ingestion.year,
        )

        if (exists) {
          skipped++
          errors.push(`Mes ${ingestion.month}/${ingestion.year} ya existe`)
          continue
        }

        // Añadir a la lista
        existingIngestions.push(ingestion)
        imported++
      }

      // Guardar datos actualizados
      if (imported > 0) {
        localStorage.setItem("monthlyIngestions", JSON.stringify(existingIngestions))

        // Disparar evento para actualizar otras pantallas
        window.dispatchEvent(new CustomEvent("ingestaCompleted"))
      }

      setImportResult({
        success: imported > 0,
        message:
          imported > 0
            ? `Importación completada: ${imported} meses importados, ${skipped} omitidos`
            : "No se importó ningún mes",
        imported,
        skipped,
        errors,
      })

      if (imported > 0) {
        setJsonInput("")
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: "Error al procesar el JSON",
        imported: 0,
        skipped: 0,
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
          <h1 className="text-3xl font-bold">Importar Meses</h1>
          <p className="text-muted-foreground">Importa ingestas mensuales desde archivos JSON</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCurrentData}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Datos Actuales
          </Button>
          <Button variant="outline" onClick={generateExampleJson}>
            <FileText className="mr-2 h-4 w-4" />
            Generar Ejemplo
          </Button>
        </div>
      </div>

      {/* Instrucciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Formato de Datos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <p>
              <strong>Estructura requerida:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>
                <code>id</code>: Identificador único (ej: "2025-1")
              </li>
              <li>
                <code>month</code>: Número del mes (1-12)
              </li>
              <li>
                <code>year</code>: Año (ej: 2025)
              </li>
              <li>
                <code>date</code>: Fecha en formato "YYYY-MM-DD"
              </li>
              <li>
                <code>expenses</code>: Objeto con gastos por categoría
              </li>
              <li>
                <code>incomes</code>: Array de ingresos
              </li>
              <li>
                <code>categoryExpenses</code>: Array de gastos detallados (opcional)
              </li>
              <li>
                <code>walletAdjustments</code>: Ajustes de monederos (opcional)
              </li>
              <li>
                <code>surplusDistribution</code>: Distribución de sobrantes (opcional)
              </li>
            </ul>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Los IDs de categorías, monederos y bienes deben existir en el sistema. Si no
              existen, la importación fallará. Usa "Importación inicial" para crear estos elementos primero.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Área de importación */}
      <Card>
        <CardHeader>
          <CardTitle>Datos JSON</CardTitle>
          <CardDescription>
            Pega aquí los datos JSON de las ingestas mensuales. Puede ser un array de meses o un solo mes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="json-input">JSON de ingestas mensuales</Label>
            <Textarea
              id="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Pega aquí el JSON con las ingestas mensuales..."
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={importData} disabled={isLoading || !jsonInput.trim()}>
              <Upload className="mr-2 h-4 w-4" />
              {isLoading ? "Importando..." : "Importar Datos"}
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

            {(importResult.imported > 0 || importResult.skipped > 0) && (
              <div className="flex gap-4">
                {importResult.imported > 0 && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {importResult.imported} importados
                  </Badge>
                )}
                {importResult.skipped > 0 && <Badge variant="secondary">{importResult.skipped} omitidos</Badge>}
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
    </div>
  )
}
