"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, AlertTriangle, CheckCircle, Calendar, FileText } from "lucide-react"

import { useRequireAuth } from "@/hooks/useRequireAuth"
import {
  saveMonthlyIngestion,
  getMonthlyIngestion,
  getMonthlyIngestionsIndex,
  createCategoryExpense,
  createIncome,
  deleteCategoryExpensesByIngestionId, // NUEVO SERVICIO (abajo)
  deleteIncomesByIngestionId,           // NUEVO SERVICIO (abajo)
} from "@/services/ingestionService"

type ImportIncome = {
  id?: string
  amount: number
  assetId: string
  description?: string
}
type ImportCategoryExpense = {
  categoryId: string
  amount: number
  walletId?: string
}
type ImportIngestion = {
  id?: string
  month: number
  year: number
  date?: string
  // Versión "legacy" resumida por categorías:
  expenses?: Record<string, number>
  // Versión detallada:
  categoryExpenses?: ImportCategoryExpense[]
  incomes: ImportIncome[]
  // Meta opcional que NO persistimos en BBDD aquí:
  walletAdjustments?: Record<string, string>
  surplusDistribution?: Record<string, number>
}

export default function ImportarMesesPage() {
  const session = useRequireAuth()
  const [jsonInput, setJsonInput] = useState("")
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    imported: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  if (!session) return null

  const generateExampleJson = () => {
    const example: ImportIngestion[] = [
      {
        month: 1,
        year: 2025,
        date: "2025-01-01",
        // Puedes usar una de las dos formas de gastos:
        expenses: {
          "uuid-categoria-1": 200.5,
          "uuid-categoria-2": 150.0,
        },
        // ...o detallado:
        // categoryExpenses: [
        //   { categoryId: "uuid-categoria-1", amount: 200.5, walletId: "uuid-wallet-1" },
        //   { categoryId: "uuid-categoria-2", amount: 150.0 }
        // ],
        incomes: [
          { amount: 2500.0, assetId: "uuid-asset-1", description: "Salario enero" },
          { amount: 120.0, assetId: "uuid-asset-2", description: "Intereses" },
        ],
        // Estos campos son meta para tu UI, aquí NO los persistimos:
        walletAdjustments: { "uuid-categoria-1": "uuid-wallet-1" },
        surplusDistribution: { "uuid-wallet-1": 50, "uuid-wallet-2": 50 },
      },
    ]
    setJsonInput(JSON.stringify(example, null, 2))
  }

  const validateIngestion = (ingestion: any): string[] => {
    const errors: string[] = []
    if (!ingestion || typeof ingestion !== "object") {
      errors.push("Objeto de ingesta inválido")
      return errors
    }
    const { month, year, incomes, expenses, categoryExpenses } = ingestion as ImportIngestion
    if (!Number.isInteger(month) || month < 1 || month > 12) errors.push("month debe ser 1..12")
    if (!Number.isInteger(year) || year < 2000) errors.push("year inválido")
    if (!Array.isArray(incomes)) errors.push("incomes debe ser un array")
    if (incomes?.some((i) => !(i && typeof i.amount === "number" && i.amount >= 0 && i.assetId))) {
      errors.push("cada income requiere amount>=0 y assetId")
    }
    if (categoryExpenses && !Array.isArray(categoryExpenses)) {
      errors.push("categoryExpenses debe ser un array si se incluye")
    }
    if (expenses && typeof expenses !== "object") {
      errors.push("expenses debe ser un objeto si se incluye")
    }
    if (!categoryExpenses && !expenses) {
      errors.push("debes incluir categoryExpenses[] o expenses{} para los gastos")
    }
    return errors
  }

  // Convierte el input (expenses{} o categoryExpenses[]) a filas para category_expenses
  const buildExpenseRows = (
    ingestion: ImportIngestion,
    ingestionId: string,
    userId: string
  ) => {
    if (Array.isArray(ingestion.categoryExpenses)) {
      return ingestion.categoryExpenses.map((e) => ({
        user_id: userId,
        monthly_ingestion_id: ingestionId,
        category_id: e.categoryId,
        amount: Number(e.amount) || 0,
        wallet_id: e.walletId || null, // se puede completar luego en la UI
      }))
    }
    const rowsFromMap = Object.entries(ingestion.expenses || {}).map(([categoryId, amount]) => ({
      user_id: userId,
      monthly_ingestion_id: ingestionId,
      category_id: categoryId,
      amount: Number(amount) || 0,
      wallet_id: null as string | null,
    }))
    return rowsFromMap
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
    const userId = session.user.id

    try {
      const parsed = JSON.parse(jsonInput)
      const ingestions: ImportIngestion[] = Array.isArray(parsed) ? parsed : [parsed]

      let imported = 0
      let skipped = 0
      const errors: string[] = []

      for (const ing of ingestions) {
        // Validación de estructura
        const v = validateIngestion(ing)
        if (v.length) {
          skipped++
          errors.push(`Ingesta ${ing.year}-${ing.month}: ${v.join("; ")}`)
          continue
        }

        // 1) Crear/obtener cabecera del mes (idempotente)
        const { data, error } = await saveMonthlyIngestion({
          user_id: userId,
          month: ing.month,
          year: ing.year,
          date: ing.date || `${ing.year}-${String(ing.month).padStart(2, "0")}-01`,
        })
        if (error || !data?.id) {
          skipped++
          errors.push(`No se pudo crear/obtener la cabecera ${ing.year}-${ing.month}: ${error || "sin id"}`)
          continue
        }
        const ingestionId = data.id as string

        // 2) Reemplazar gastos/ingresos de ese mes (delete + insert)
        await deleteCategoryExpensesByIngestionId(ingestionId)
        await deleteIncomesByIngestionId(ingestionId)

        // 2a) Gastos por categoría
        const expenseRows = buildExpenseRows(ing, ingestionId, userId)
        // Inserta todos (incluye amount=0 para dejar todas las categorías preparadas si quieres)
        if (expenseRows.length > 0) {
          await Promise.all(expenseRows.map((row) => createCategoryExpense(row)))
        }

        // 2b) Ingresos
        const incomeRows = (ing.incomes || []).map((i) => ({
          user_id: userId,
          monthly_ingestion_id: ingestionId,
          amount: Number(i.amount) || 0,
          asset_id: i.assetId, // FK obligatoria
          description: i.description || null,
        }))
        // Solo guardamos ingresos con amount > 0 (regla habitual)
        const validIncomes = incomeRows.filter((r) => r.amount > 0 && r.asset_id)
        if (validIncomes.length > 0) {
          await Promise.all(validIncomes.map((row) => createIncome(row)))
        }

        imported++
      }

      // Dispara evento para que otras pantallas se refresquen
      if (imported > 0) {
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

      if (imported > 0) setJsonInput("")
    } catch (err: any) {
      setImportResult({
        success: false,
        message: "Error al procesar el JSON",
        imported: 0,
        skipped: 0,
        errors: [err?.message || "Error desconocido"],
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Exporta meses existentes desde BBDD en el mismo shape de ejemplo
  const exportCurrentData = async () => {
    try {
      setIsExporting(true)
      const idx = await getMonthlyIngestionsIndex()
      if (!idx || idx.length === 0) {
        alert("No hay ingestas en la base de datos")
        return
      }

      // Cargar todas las ingestas para exportar
      const months = idx
        .slice()
        .sort((a, b) => (a.year - b.year) || (a.month - b.month))

      const all: any[] = []
      for (const m of months) {
        const mi = await getMonthlyIngestion(m.year, m.month)
        if (!mi) continue

        // Reconstruir objeto "expenses" resumido
        const expensesObj: Record<string, number> = {}
        ;(mi.expenses || []).forEach((e: any) => {
          expensesObj[e.category_id] = Number(e.amount) || 0
        })

        // Incomes
        const incomes = (mi.incomes || []).map((i: any) => ({
          id: i.id,
          amount: Number(i.amount) || 0,
          assetId: i.asset_id,
          description: i.description || undefined,
        }))

        all.push({
          id: mi.id,
          month: mi.month,
          year: mi.year,
          date: mi.date,
          expenses: expensesObj,
          incomes,
          // Opcionalmente podrías incluir el array detallado:
          // categoryExpenses: (mi.expenses || []).map((e: any) => ({
          //   categoryId: e.category_id, amount: Number(e.amount)||0, walletId: e.wallet_id || undefined
          // })),
          walletAdjustments: {},   // no persistimos este meta
          surplusDistribution: {}, // no persistimos este meta
        })
      }

      const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ingestas-mensuales-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(`Error exportando: ${e?.message || "desconocido"}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Importar Meses</h1>
          <p className="text-muted-foreground">Importa ingestas mensuales desde archivos JSON directamente a tu BBDD</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCurrentData} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exportando..." : "Exportar Datos Actuales"}
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
              <strong>Estructura aceptada:</strong> puedes usar <code>expenses</code> como objeto resumido o
              <code> categoryExpenses[]</code> para detalle. Se crearán/actualizarán las ingestas y sus gastos/ingresos.
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><code>month</code> (1-12), <code>year</code> (≥ 2000), <code>date</code> "YYYY-MM-DD" (opcional)</li>
              <li><code>expenses</code>: {"{ [categoryId]: amount }"}</li>
              <li><code>categoryExpenses</code>: [{"{ categoryId, amount, walletId? }"}]</li>
              <li><code>incomes</code>: [{"{ amount, assetId, description? }"}] (assetId debe existir)</li>
            </ul>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Los IDs de <em>categorías</em> y <em>bienes</em> deben existir. Los campos
              <code> walletAdjustments</code> y <code> surplusDistribution</code> son meta de UI; aquí no se guardan:
              podrás asignar monederos/excesos en la pantalla de Ingesta.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Área de importación */}
      <Card>
        <CardHeader>
          <CardTitle>Datos JSON</CardTitle>
          <CardDescription>Pega aquí los datos JSON de las ingestas mensuales (un mes o un array de meses).</CardDescription>
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
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="text-muted-foreground">• {e}</li>
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
