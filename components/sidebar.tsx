"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Home, Calendar, PieChart, Wallet, Tag, Building2, TrendingUp } from "lucide-react"

const navigation = [
  {
    name: "Resumen Financiero",
    href: "/resumen",
    icon: TrendingUp,
  },
  {
    name: "Evolución Monederos",
    href: "/evolucion",
    icon: TrendingUp,
  },
  {
    name: "Histórico",
    href: "/historico",
    icon: Home,
  },
  {
    name: "Ingesta Mensual",
    href: "/ingesta",
    icon: Calendar,
  },
  {
    name: "Categorías",
    href: "/categorias",
    icon: Tag,
  },
  {
    name: "Monederos",
    href: "/monederos",
    icon: Wallet,
  },
  {
    name: "Bienes",
    href: "/bienes",
    icon: Building2,
  },
  {
    name: "Configuración de redistribución",
    href: "/configuracion",
    icon: PieChart,
  },
  {
    name: "Importar meses",
    href: "/importar-meses",
    icon: Calendar,
  },
  {
    name: "Importación inicial",
    href: "/importacion-inicial",
    icon: Building2,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 bg-card border-r">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <PieChart className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold">FinanceApp</h1>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn("w-full justify-start", isActive && "bg-primary text-primary-foreground")}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
              </Button>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
