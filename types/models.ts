// types/models.ts

// === TIPOS BASE ===

export type CategoryTypeName =
  | "gasto"
  | "gasto_acumulativo"
  | "gasto_mixto"
  | "gasto_acumulativo_opcional"

export type AssetTypeName =
  | "cuenta_bancaria"
  | "efectivo"
  | "inversion"
  | "propiedad"
  | "otro"

export type WalletTransactionTypeName =
  | "excess"
  | "surplus"
  | "accumulative"
  | "distribution"
  | "manual"

export type AssetTransactionTypeName =
  | "income"
  | "manual"

// === TABLAS DE TIPOS ===

export interface CategoryType {
  id: number
  name: CategoryTypeName
}

export interface AssetType {
  id: number
  name: AssetTypeName
}

export interface WalletTransactionType {
  id: number
  name: WalletTransactionTypeName
}

export interface AssetTransactionType {
  id: number
  name: AssetTransactionTypeName
}

// === TABLAS PRINCIPALES ===
//en uso
export interface Wallet {
  id: string
  user_id: string
  name: string
  current_balance: number
  target_balance: number | null
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  user_id: string
  name: string
  asset_type_id: number | null
  current_balance: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  category_type_id: number | null
  monthly_budget: number
  annual_budget: number | null
  active: boolean
  wallet_id: string | null
  created_at: string
  updated_at: string
}

export interface EnrichedCategory extends Category {
  category_types: {
    name: CategoryTypeName
  } | null
}

export interface MonthlyIngestion {
  id: string
  user_id: string
  month: number
  year: number
  date: string
  created_at: string
  updated_at: string
}

export interface EnrichedMonthlyIngestion extends MonthlyIngestion {
  expenses: CategoryExpense[]
  incomes: Income[]
  // Si quieres usar luego: walletAdjustments, surplusDistribution...
}


export interface CategoryExpense {
  id: string
  user_id: string
  monthly_ingestion_id: string
  category_id: string
  amount: number
  wallet_id: string | null
  created_at: string
}

export interface Income {
  id: string
  user_id: string
  monthly_ingestion_id: string
  amount: number
  asset_id: string
  description: string | null
  created_at: string
}

export type DistributionRuleType = "percentage" | "fixed"

export interface DistributionRule {
  id: string
  user_id: string
  wallet_id: string
  type: DistributionRuleType
  value: number
  priority: number
  created_at: string
  updated_at: string
}

export interface WalletTransaction {
  id: string
  user_id: string
  wallet_id: string
  monthly_ingestion_id: string | null
  amount: number
  wallet_transaction_type_id: number | null
  description: string | null
  created_at: string
}

export interface AssetTransaction {
  id: string
  user_id: string
  asset_id: string
  monthly_ingestion_id: string | null
  amount: number
  asset_transaction_type_id: number | null
  description: string | null
  created_at: string
}
