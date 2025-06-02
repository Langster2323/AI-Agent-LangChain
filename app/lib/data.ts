import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { OpenAIEmbeddings } from "@langchain/openai"
import { MemoryVectorStore } from "langchain/vectorstores/memory"
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"

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
    
    // Process each chunk to improve context
    const processedDocs = splitDocs.map(doc => {
      const content = doc.pageContent
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/\n/g, ' ')   // Replace newlines with spaces
        .trim()
      
      // Add metadata to help with context
      return {
        content,
        pageNumber: doc.metadata.page,
        section: extractSection(content),
      }
    })

    // Log sample content for verification
    if (processedDocs.length > 0) {
      console.log("Sample content from first chunk:", processedDocs[0].content.substring(0, 200))
    }

    return processedDocs.map(doc => doc.content)
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
    modelName: "text-embedding-3-large", // Using the latest embedding model
  })
  
  const vectorStore = await MemoryVectorStore.fromTexts(docs, [], embeddings)
  return vectorStore
}

export async function createCsvVectorStore(csvData: any[]) {
  // Improve CSV processing to include more context
  const texts = csvData.map((item) => {
    const fieldLabel = item.field_label || item.Field || ""
    const instructions = item.instructions || item.Instructions || ""
    const category = item.category || item.Category || ""
    const required = item.required || item.Required || ""
    
    return `Category: ${category}
Field: ${fieldLabel}
Required: ${required}
Instructions: ${instructions}`
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
