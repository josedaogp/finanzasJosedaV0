"use client"
import { ThemeProvider } from "@/components/theme-provider"
import { Sidebar } from "@/components/sidebar"
import { useSession } from "@supabase/auth-helpers-react"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = useSession()

  if (session === undefined) {
    // Loader solo mientras la sesión se resuelve
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <span className="text-muted-foreground text-lg">Cargando...</span>
      </div>
    )
  }

  // SIEMPRE renderiza children cuando la sesión es null o válida
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="flex h-screen bg-background">
        {session != null ? (
          <>
            <Sidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </>
        ) : (
          <main className="flex-1 overflow-y-auto">{children}</main>
        )}
      </div>
    </ThemeProvider>
  )
}
