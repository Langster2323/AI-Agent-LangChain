"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/app/components/ui/atoms/button"
import { Input } from "@/app/components/ui/atoms/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/organisms/card"
import { Badge } from "@/app/components/ui/atoms/badge"
import { Loader2, FileText, Database } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
  source?: string
  context?: string
}

export default function Home() {
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError("")

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    // Add user message immediately
    const userMessage: Message = {
      role: "user",
      content: query
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let answer = ""
      let metadata: any = null

      // Add assistant message placeholder
      const assistantMessage: Message = {
        role: "assistant",
        content: "",
        source: "PDF",
        context: ""
      }
      setMessages(prev => [...prev, assistantMessage])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const data = JSON.parse(line)
            if (data.type === "metadata") {
              metadata = data.data
              // Update the assistant message with metadata
              setMessages(prev => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]
                if (lastMessage.role === "assistant") {
                  lastMessage.source = metadata.source
                  lastMessage.context = metadata.context
                }
                return newMessages
              })
            }
          } catch {
            // If it's not JSON, it's part of the answer
            answer += line
            // Update the assistant message content
            setMessages(prev => {
              const newMessages = [...prev]
              const lastMessage = newMessages[newMessages.length - 1]
              if (lastMessage.role === "assistant") {
                lastMessage.content = answer
              }
              return newMessages
            })
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Request aborted")
      } else {
        console.error("Error:", error)
        setError("Failed to get response. Please try again.")
      }
    } finally {
      setLoading(false)
      setQuery("")
      abortControllerRef.current = null
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

        <Card className="mb-6 sticky top-4 z-10 bg-white/80 backdrop-blur-sm">
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

        <div className="space-y-4">
          {messages.map((message, index) => (
            <Card 
              key={index}
              ref={index === messages.length - 1 ? lastMessageRef : null}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{message.role === "user" ? "Your Question" : "Answer"}</CardTitle>
                  {message.role === "assistant" && message.source && (
                    <Badge className={`${getSourceColor(message.source)} flex items-center gap-1`}>
                      {getSourceIcon(message.source)}
                      Source: {message.source}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose max-w-none">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>

                {message.role === "assistant" && message.context && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                      View Context Used
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm text-gray-700">{message.context}</div>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
          <div ref={messagesEndRef} />
        </div>

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
