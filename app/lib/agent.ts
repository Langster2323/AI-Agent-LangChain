import OpenAI from "openai"
import { createPdfVectorStore, createCsvVectorStore } from "./data"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
    let hasPdfResults = false
    let hasCsvResults = false

    // Search in PDF with multiple terms
    const pdfResults = await Promise.all(
      searchTerms.map(term => pdfVectorStore.similaritySearch(term, 5))
    )
    const flatPdfResults = pdfResults.flat()
    if (flatPdfResults.length > 0) {
      hasPdfResults = true
      results.push(...flatPdfResults)
    }

    // Search in CSV if relevant
    const csvSearchTerms = [
      "field", "form", "template", "award", "achievement", "bullet",
      "input", "required", "mandatory", "optional", "section", "column",
      "header", "data", "entry", "fill", "complete", "submit"
    ]

    const shouldSearchCsv = csvSearchTerms.some(term => 
      query.toLowerCase().includes(term.toLowerCase())
    )

    if (shouldSearchCsv) {
      const csvResults = await Promise.all(
        searchTerms.map(term => csvVectorStore.similaritySearch(term, 5))
      )
      const flatCsvResults = csvResults.flat()
      if (flatCsvResults.length > 0) {
        hasCsvResults = true
        results.push(...flatCsvResults)
      }
    }

    console.log(`Found ${results.length} relevant results (PDF: ${hasPdfResults}, CSV: ${hasCsvResults})`)

    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(new Set(results.map(r => r.pageContent)))
      .map(content => results.find(r => r.pageContent === content))
      .filter(Boolean)

    const fullContext = uniqueResults.map((r) => r.pageContent).join("\n\n")
    
    // Always show context if we have results
    const displayContext = results.length > 0
      ? fullContext.substring(0, Math.min(500, fullContext.length)) + (fullContext.length > 500 ? "..." : "")
      : "No relevant context found."

    console.log("Context length:", fullContext.length)
    console.log("Display context:", displayContext)

    const prompt = `You are an expert in military doctrine and forms. Use the following context to answer the question.
If you cannot answer the question from the context, respond that you cannot answer the question based on the available information.
Be specific and detailed in your response, citing relevant information from the context when possible.
If the question is about a process or methodology, break down the steps clearly.

Context:
${fullContext}

Question: ${query}

Answer:`

    // Create a stream from the OpenAI API
    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an administrative NCO in the US Army. You are tasked with providing information about the Army Field Manual (FM) 5-0 and the form fields for the FM 5-0. Provide detailed, concise, and accurate information based on the provided context. When explaining processes, break them down into clear, sequential steps."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      stream: true
    })

    // Determine the source based on which data sources were used
    let source = "PDF"
    if (hasPdfResults && hasCsvResults) {
      source = "BOTH"
    } else if (hasCsvResults) {
      source = "CSV"
    }

    return {
      stream,
      metadata: {
        source,
        context: displayContext,
        hasMoreContext: fullContext.length > 500,
        totalResults: results.length
      }
    }
  } catch (error) {
    console.error("Agent error:", error)
    throw new Error(`Agent error: ${error instanceof Error ? error.message : String(error)}`)
  }
}
