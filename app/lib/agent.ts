import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createPdfVectorStore, createCsvVectorStore } from "@/app/lib/data"

// Common military terms and their variations
const MILITARY_TERMS = {
  "MDMP": ["Military Decision Making Process", "military decision making process", "MDMP"],
  "S6": ["G6", "Signal Officer", "S6", "communications"],
  "planning": ["plan", "planning process", "planning procedures", "planning steps"],
  "process": ["procedure", "methodology", "approach", "steps"],
}

function expandQuery(query: string): string[] {
  const terms = query.toLowerCase().split(" ")
  const expandedTerms: string[] = [query]

  // Add variations of military terms
  terms.forEach(term => {
    Object.entries(MILITARY_TERMS).forEach(([key, variations]) => {
      if (term.includes(key.toLowerCase())) {
        variations.forEach(variation => {
          const newQuery = query.replace(new RegExp(key, 'gi'), variation)
          expandedTerms.push(newQuery)
        })
      }
    })
  })

  // Add specific planning-related queries
  if (query.toLowerCase().includes("planning")) {
    expandedTerms.push(
      "What are the steps in the planning process?",
      "How does the planning process work?",
      "What is the planning methodology?",
      "What are the planning procedures?"
    )
  }

  return [...new Set(expandedTerms)]
}

export async function runAgent(query: string, pdfBuffer: ArrayBuffer, csvData: any[]) {
  try {
    console.log("Processing query:", query)
    
    const pdfVectorStore = await createPdfVectorStore(pdfBuffer)
    const csvVectorStore = await createCsvVectorStore(csvData)

    // Expand the query with variations and related terms
    const searchTerms = expandQuery(query)
    console.log("Search terms:", searchTerms)

    const results: any[] = []

    // Search in PDF with multiple terms
    const pdfResults = await Promise.all(
      searchTerms.map(term => pdfVectorStore.similaritySearch(term, 5))
    )
    results.push(...pdfResults.flat())

    // Search in CSV if relevant
    if (
      query.toLowerCase().includes("field") ||
      query.toLowerCase().includes("form") ||
      query.toLowerCase().includes("template") ||
      query.toLowerCase().includes("award") ||
      query.toLowerCase().includes("achievement") ||
      query.toLowerCase().includes("bullet")
    ) {
      const csvResults = await Promise.all(
        searchTerms.map(term => csvVectorStore.similaritySearch(term, 5))
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
If the question is about a process or methodology, break down the steps clearly.

Context:
${fullContext}

Question: ${query}

Answer:`

    const { text } = await generateText({
      model: openai("gpt-4"),
      prompt,
      system: "You are an administrative NCO in the US Army. You are tasked with providing information about the Army Field Manual (FM) 5-0 and the form fields for the FM 5-0. Provide detailed, concise, and accurate information based on the provided context. When explaining processes, break them down into clear, sequential steps.",
    })

    return { 
      answer: text, 
      source: "PDF", 
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
