import { supabase } from "@/lib/supabaseClient"
import { DistributionRule } from "@/types/models"

export async function fetchDistributionRules(userId: string): Promise<DistributionRule[]> {
  const { data, error } = await supabase
    .from("distribution_rules")
    .select("*")
    .eq("user_id", userId)
    .order("priority", { ascending: true })

  if (error) throw new Error(error.message)
  return data as DistributionRule[]
}

export async function upsertDistributionRule(
  rule: Omit<DistributionRule, "id" | "created_at" | "updated_at">
): Promise<DistributionRule> {
  // Usa solo UN string en onConflict
  const { data, error } = await supabase
    .from("distribution_rules")
    .upsert([rule], { onConflict: "user_id,wallet_id" })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as DistributionRule
}

export async function deleteDistributionRule(userId: string, walletId: string): Promise<void> {
  const { error } = await supabase
    .from("distribution_rules")
    .delete()
    .eq("user_id", userId)
    .eq("wallet_id", walletId)

  if (error) throw new Error(error.message)
}
