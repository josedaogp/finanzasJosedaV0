"use client"
import { useEffect, useState } from "react"
import { useSupabaseClient } from "@supabase/auth-helpers-react"
import { useSearchParams, useRouter } from "next/navigation"

export default function ResetPasswordPage() {
  const supabase = useSupabaseClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  // SÓLO redirige si el tipo NO es recovery
  useEffect(() => {
    const type = searchParams.get("type")
    if (type !== "recovery") {
      router.replace("/login")
    }
    // NO HAGAS REDIRECT SI YA HAY SESIÓN
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message)
    else {
      setSuccess("¡Contraseña actualizada! Ya puedes iniciar sesión.")
      setTimeout(() => router.replace("/login"), 2000)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#182540]">
      <div className="bg-[#202939] p-8 rounded-xl shadow-xl w-full max-w-md border border-[#22334a]">
        <h1 className="text-2xl text-white font-bold mb-6 text-center">Restablecer contraseña</h1>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nueva contraseña"
            className="rounded-md px-3 py-2 bg-[#181f2c] text-white border border-[#2a3650] focus:ring-2 focus:ring-[#2576fd] focus:outline-none"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoFocus
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            className="rounded-md px-3 py-2 bg-[#181f2c] text-white border border-[#2a3650] focus:ring-2 focus:ring-[#2576fd] focus:outline-none"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={6}
          />
          {error && <div className="text-red-400 text-sm">{error}</div>}
          {success && <div className="text-green-400 text-sm">{success}</div>}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#2576fd] hover:bg-[#296bdf] transition-colors text-white py-2 rounded-md font-bold text-lg"
          >
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  )
}
