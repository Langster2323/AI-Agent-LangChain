"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/app/components/ui/atoms/button"
import { Input } from "@/app/components/ui/atoms/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/organisms/card"
import { Badge } from "@/app/components/ui/atoms/badge"
import { Loader2, FileText, Database } from "lucide-react"

export default function Home() {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<{
    answer: string
    source: string
    context: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError("")
    setResult(null)

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (error) {
      console.error("Error:", error)
      setError("Failed to get response. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "PDF":
        return <FileText className="w-4 h-4" />
      case "CSV":
        return <Database className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case "PDF":
        return "bg-blue-100 text-blue-800"
      case "CSV":
        return "bg-green-100 text-green-800"
      case "BOTH":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AI Agent for Military Document Retrieval</h1>
          <p className="text-gray-600">Ask questions about military doctrine. Access (PDF) or form fields (CSV)</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Ask a Question</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., What are the key principles of planning? or What fields are required for awards?"
                  className="flex-1"
                  disabled={loading}
                />
                <Button type="submit" disabled={loading || !query.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Ask"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-red-200">
            <CardContent className="pt-6">
              <div className="text-red-600">
                <strong>Error:</strong> {error}
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Answer</CardTitle>
                <Badge className={`${getSourceColor(result.source)} flex items-center gap-1`}>
                  {getSourceIcon(result.source)}
                  Source: {result.source}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose max-w-none">
                <p className="text-gray-800 leading-relaxed">{result.answer}</p>
              </div>

              {result.context && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                    View Context Used
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm text-gray-700">{result.context}</div>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This AI agent uses LangChain.js to retrieve information from military doctrine (PDF) and form templates
            (CSV).
          </p>
        </div>
      </div>
    </div>
  )
}
