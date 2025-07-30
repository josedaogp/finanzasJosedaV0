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

  if (session === undefined) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="text-muted-foreground text-lg">Cargando...</span>
      </div>
    )
  }

  if (session === null) return null

  return session
}
