// /hooks/useRequireAuth.ts
import { useSession } from "@supabase/auth-helpers-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function useRequireAuth() {
  const session = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session === null) {
      router.replace("/login")
    }
  }, [session, router])

  if (session === undefined) return null
  if (session === null) return null

  return session // <-- esto es la sesión con el user, si todo está bien
}
