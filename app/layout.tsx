import type React from "react"
import { ThemeProvider } from "@/app/components/ui/templates/theme-provider"
import "./globals.css"

export const metadata = {
  title: "AI Agent for Document Retrieval",
  description: "Reasoning-based retrieval from documents and data using LangChain.js",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}