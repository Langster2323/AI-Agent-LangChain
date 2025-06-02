import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createPdfVectorStore, createCsvVectorStore } from "./data"

export async function runAgent(query: string, pdfBuffer: ArrayBuffer, csvData: any[]) {
  try {
    console.log("Processing query:", query)
    
    const pdfVectorStore = await createPdfVectorStore(pdfBuffer)
    const csvVectorStore = await createCsvVectorStore(csvData)

    // Simple reasoning to determine which source to use
    let source = "PDF"
    const queryLower = query.toLowerCase()

    // Expand search terms for better matching
    const searchTerms = [
      query,
      query.replace("MDMP", "Military Decision Making Process"),
      query.replace("S6", "G6"),
      query.replace("S6", "Signal Officer"),
      query.replace("MDMP", "military decision making process"),
    ]

    console.log("Search terms:", searchTerms)

    const results: any[] = []

    // Search in PDF with multiple terms
    const pdfResults = await Promise.all(
      searchTerms.map(term => pdfVectorStore.similaritySearch(term, 3))
    )
    results.push(...pdfResults.flat())

    // Search in CSV if relevant
    if (
      queryLower.includes("field") ||
      queryLower.includes("form") ||
      queryLower.includes("template") ||
      queryLower.includes("award") ||
      queryLower.includes("achievement") ||
      queryLower.includes("bullet")
    ) {
      const csvResults = await Promise.all(
        searchTerms.map(term => csvVectorStore.similaritySearch(term, 3))
      )
      results.push(...csvResults.flat())
    }

    console.log(`Found ${results.length} relevant results`)

    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(new Set(results.map(r => r.pageContent)))
      .map(content => results.find(r => r.pageContent === content))
      .filter(Boolean)

    const fullContext = uniqueResults.map((r) => r.pageContent).join("\n\n")
    
    // Ensure we have a minimum amount of context to display
    const displayContext = fullContext.length > 0 
      ? fullContext.substring(0, Math.min(500, fullContext.length)) + (fullContext.length > 500 ? "..." : "")
      : "No relevant context found."

    const prompt = `You are an expert in military doctrine and forms. Use the following context to answer the question.
If you cannot answer the question from the context, respond that you cannot answer the question based on the available information.
Be specific and detailed in your response, citing relevant information from the context when possible.

Context:
${fullContext}

Question: ${query}

Answer:`

    const { text } = await generateText({
      model: openai("gpt-4"),
      prompt,
      system: "You are an administrative NCO in the US Army. You are tasked with providing information about the Army Field Manual (FM) 5-0 and the form fields for the FM 5-0. Provide detailed, concise, and accurate information based on the provided context.",
    })

    return { 
      answer: text, 
      source, 
      context: displayContext,
      hasMoreContext: fullContext.length > 500
    }
  } catch (error) {
    console.error("Agent error:", error)
    return {
      answer: "I encountered an error while processing your request. Please try again.",
      source: "ERROR",
      context: "Error occurred while processing the request.",
      hasMoreContext: false
    }
  }
}
