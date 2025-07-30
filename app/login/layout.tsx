import { Inter } from "next/font/google"
const inter = Inter({ subsets: ["latin"] })

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.className}>
      <body
        style={{ background: "#182540" }}
        className="min-h-screen flex items-center justify-center"
      >
        {children}
      </body>
    </html>
  )
}
