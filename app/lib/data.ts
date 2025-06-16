import { Document } from "langchain/document"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { OpenAIEmbeddings } from "@langchain/openai"
import { MemoryVectorStore } from "langchain/vectorstores/memory"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"

// MCP Implementation
class MemoryContextProcessor {
  private memory: Map<string, any> = new Map()
  private contextWindow: number = 5
  private maxTokens: number = 4000

  constructor(contextWindow: number = 5, maxTokens: number = 4000) {
    this.contextWindow = contextWindow
    this.maxTokens = maxTokens
  }

  // Add content to memory with metadata
  addToMemory(key: string, content: string, metadata: any = {}) {
    this.memory.set(key, {
      content,
      metadata,
      timestamp: Date.now(),
      tokens: this.estimateTokens(content)
    })
  }

  // Get relevant context based on query
  async getRelevantContext(query: string, embeddings: OpenAIEmbeddings): Promise<string> {
    const queryEmbedding = await embeddings.embedQuery(query)
    const contexts: { key: string; similarity: number; content: string }[] = []

    // Calculate similarity for each memory item
    for (const [key, value] of this.memory.entries()) {
      const contentEmbedding = await embeddings.embedQuery(value.content)
      const similarity = this.cosineSimilarity(queryEmbedding, contentEmbedding)
      contexts.push({ key, similarity, content: value.content })
    }

    // Sort by similarity and get top contexts
    contexts.sort((a, b) => b.similarity - a.similarity)
    const topContexts = contexts.slice(0, this.contextWindow)

    // Combine contexts while respecting token limit
    let combinedContext = ""
    let totalTokens = 0

    for (const context of topContexts) {
      const contextTokens = this.estimateTokens(context.content)
      if (totalTokens + contextTokens <= this.maxTokens) {
        combinedContext += context.content + "\n\n"
        totalTokens += contextTokens
      } else {
        break
      }
    }

    return combinedContext.trim()
  }

  // Clear old memories
  clearOldMemories(maxAge: number = 3600000) { // Default 1 hour
    const now = Date.now()
    for (const [key, value] of this.memory.entries()) {
      if (now - value.timestamp > maxAge) {
        this.memory.delete(key)
      }
    }
  }

  // Helper function to estimate tokens
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4) // Rough estimate
  }

  // Helper function to calculate cosine similarity
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (normA * normB)
  }
}

// Create a singleton instance
const mcp = new MemoryContextProcessor()

export async function loadAndProcessPdf(pdfBuffer: ArrayBuffer) {
  try {
    // Convert ArrayBuffer to Blob for PDFLoader
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    const loader = new PDFLoader(blob)
    const docs = await loader.load()
    
    console.log(`Loaded ${docs.length} pages from PDF`)
    
    // Create a more sophisticated text splitter for military doctrine
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 300,
      separators: [
        "\n\n", // Paragraph breaks
        "\n",   // Line breaks
        ". ",   // Sentences
        "! ",   // Exclamations
        "? ",   // Questions
        "; ",   // Semi-colons
        ": ",   // Colons
        ", ",   // Commas
        " ",    // Words
        ""      // Characters
      ],
    })

    const splitDocs = await textSplitter.splitDocuments(docs)
    console.log(`Split into ${splitDocs.length} chunks`)
    
    // Process each chunk and add to MCP
    const processedDocs = splitDocs.map(doc => {
      const content = doc.pageContent
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/\n/g, ' ')   // Replace newlines with spaces
        .trim()
      
      // Add to MCP with metadata
      mcp.addToMemory(
        `pdf_${doc.metadata.page || 1}`,
        content,
        {
          source: "pdf",
          page: doc.metadata.page || 1,
          ...doc.metadata
        }
      )

      return new Document({
        pageContent: content,
        metadata: {
          source: "pdf",
          page: doc.metadata.page || 1,
          ...doc.metadata
        }
      })
    })

    return processedDocs
  } catch (error) {
    console.error("Error loading or processing PDF:", error)
    return []
  }
}

// Helper function to extract section information
function extractSection(content: string): string {
  const sectionMatch = content.match(/^([A-Z][A-Z0-9-]+\.\s+[A-Z][a-z\s]+)/)
  return sectionMatch ? sectionMatch[1] : "Unknown Section"
}

export async function createPdfVectorStore(pdfBuffer: ArrayBuffer) {
  const docs = await loadAndProcessPdf(pdfBuffer)
  console.log(`Creating vector store with ${docs.length} documents`)
  
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-3-large",
  })

  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings)
  
  // Override similarity search to use MCP
  const originalSimilaritySearch = vectorStore.similaritySearch.bind(vectorStore)
  vectorStore.similaritySearch = async (query: string, k?: number) => {
    // Get relevant context from MCP
    const context = await mcp.getRelevantContext(query, embeddings)
    
    // Combine with vector store results
    const vectorResults = await originalSimilaritySearch(query, k)
    
    // Add context to results
    if (context) {
      vectorResults.unshift(new Document({
        pageContent: context,
        metadata: { source: "mcp", type: "context" }
      }))
    }
    
    return vectorResults
  }

  return vectorStore
}

export async function createCsvVectorStore(csvData: any[]) {
  // Improve CSV processing to include more context
  const texts = csvData.map((item) => {
    const fieldLabel = item.field_label || item.Field || ""
    const instructions = item.instructions || item.Instructions || ""
    const category = item.category || item.Category || ""
    const required = item.required || item.Required || ""
    
    const content = `Category: ${category}
Field: ${fieldLabel}
Required: ${required}
Instructions: ${instructions}`

    // Add to MCP
    mcp.addToMemory(
      `csv_${fieldLabel}`,
      content,
      {
        source: "csv",
        field: fieldLabel,
        category,
        required
      }
    )

    return content
  })

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
  })

  const docs = await textSplitter.splitText(texts.join("\n\n"))
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-3-large",
  })
  
  const vectorStore = await MemoryVectorStore.fromTexts(docs, [], embeddings)
  
  // Override similarity search to use MCP
  const originalSimilaritySearch = vectorStore.similaritySearch.bind(vectorStore)
  vectorStore.similaritySearch = async (query: string, k?: number) => {
    // Get relevant context from MCP
    const context = await mcp.getRelevantContext(query, embeddings)
    
    // Combine with vector store results
    const vectorResults = await originalSimilaritySearch(query, k)
    
    // Add context to results
    if (context) {
      vectorResults.unshift(new Document({
        pageContent: context,
        metadata: { source: "mcp", type: "context" }
      }))
    }
    
    return vectorResults
  }

  return vectorStore
}

export function parseCsv(csvText: string) {
  const lines = csvText.split("\n")
  const headers = lines[0].split(",").map((h) => h.trim())
  const data = []

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(",").map((v) => v.trim())
      const row: any = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ""
      })
      data.push(row)
    }
  }

  return data
}
