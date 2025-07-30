"use client"
import { useState } from "react"
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react"

export function AuthWidget() {
  const supabase = useSupabaseClient()
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const resetStates = () => {
    setError(null)
    setSuccess(null)
    setPassword("")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError("Correo o contraseña incorrectos, o cuenta no confirmada.")
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else setSuccess("Revisa tu correo para confirmar tu cuenta.")
    setLoading(false)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
    if (error) setError(error.message)
    else setSuccess("Te hemos enviado instrucciones para restaurar la contraseña.")
    setLoading(false)
  }

  // Logo chulo y simple tipo BrightID
  const Logo = () => (
    <div className="flex items-center gap-2 mb-6">
      <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="6" width="36" height="36" rx="10" fill="#2576fd"/>
        <rect x="18" y="18" width="12" height="12" rx="3" fill="#fff"/>
      </svg>
      <span className="text-2xl font-bold text-white select-none">
        <span className="text-[#2576fd]">Finanzas</span>Joseda
      </span>
    </div>
  )

  return (
    <div className="w-full max-w-[400px] bg-[#202939] rounded-2xl shadow-xl px-8 py-10 flex flex-col items-center border border-[#22334a]">
      <Logo />
      <h1 className="text-xl font-bold mb-4 text-white">
        {mode === "login"
          ? "Iniciar sesión"
          : mode === "register"
          ? "Crear cuenta"
          : "¿Olvidaste tu contraseña?"}
      </h1>
      <form className="w-full flex flex-col gap-4" onSubmit={
        mode === "login"
          ? handleLogin
          : mode === "register"
          ? handleRegister
          : handleForgot
      }>
        <div>
          <label className="block text-white text-sm mb-1">Email</label>
          <input
            type="email"
            className="w-full rounded-md px-3 py-2 bg-[#181f2c] text-white border border-[#2a3650] focus:ring-2 focus:ring-[#2576fd] focus:outline-none"
            placeholder="you@email.com"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        {mode !== "forgot" && (
          <div>
            <label className="block text-white text-sm mb-1">Contraseña</label>
            <input
              type="password"
              className="w-full rounded-md px-3 py-2 bg-[#181f2c] text-white border border-[#2a3650] focus:ring-2 focus:ring-[#2576fd] focus:outline-none"
              placeholder="********"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required={mode !== "forgot"}
            />
          </div>
        )}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {success && <div className="text-green-400 text-sm">{success}</div>}

        <button
          className="bg-[#2576fd] hover:bg-[#296bdf] transition-colors text-white py-2 rounded-md font-bold text-lg mt-2"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Procesando..."
            : mode === "login"
            ? "Iniciar sesión"
            : mode === "register"
            ? "Crear cuenta"
            : "Enviar email"
          }
        </button>
      </form>
      {/* Links para cambiar de modo */}
      {mode === "login" && (
        <div className="w-full mt-4 flex flex-col items-start gap-2 text-sm">
          <button
            onClick={() => { setMode("forgot"); resetStates() }}
            className="text-[#2576fd] hover:underline transition"
          >
            ¿Olvidaste tu contraseña?
          </button>
          <span>
            ¿No tienes cuenta?{" "}
            <button
              onClick={() => { setMode("register"); resetStates() }}
              className="text-[#2576fd] hover:underline font-medium"
            >
              Regístrate
            </button>
          </span>
        </div>
      )}
      {mode === "register" && (
        <div className="w-full mt-4 flex flex-col items-start gap-2 text-sm">
          <span>
            ¿Ya tienes cuenta?{" "}
            <button
              onClick={() => { setMode("login"); resetStates() }}
              className="text-[#2576fd] hover:underline font-medium"
            >
              Inicia sesión
            </button>
          </span>
        </div>
      )}
      {mode === "forgot" && (
        <div className="w-full mt-4 flex flex-col items-start gap-2 text-sm">
          <button
            onClick={() => { setMode("login"); resetStates() }}
            className="text-[#2576fd] hover:underline"
          >
            Volver a iniciar sesión
          </button>
        </div>
      )}
      <div className="mt-6 w-full text-xs text-gray-500 flex justify-between items-center">
        <a href="/privacy-policy" className="hover:underline">Política de privacidad</a>
      </div>
    </div>
  )
}
