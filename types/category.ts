// types/category.ts

import { CategoryType, Wallet } from "./models"

// 1. Sin relación
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

// 2. Con relación anidada
export interface CategoryWithType extends Category {
  category_types: CategoryType | null // O "category_type" si renombras la relación en el select
  wallets?: Wallet | null // Si quisieras la relación wallet, igual
}
