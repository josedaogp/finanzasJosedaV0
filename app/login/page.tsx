"use client"
import { AuthWidget } from "@/components/AuthWidget"
import { useSession } from "@supabase/auth-helpers-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function LoginPage() {
  const session = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) {
      router.replace("/historico") // O la ruta privada inicial que prefieras
    }
  }, [session, router])

  return <AuthWidget />
}
