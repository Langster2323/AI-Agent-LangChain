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
    
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    })

    const splitDocs = await textSplitter.splitDocuments(docs)
    console.log(`Split into ${splitDocs.length} chunks`)
    
    // Log a sample of the content to verify it's being processed correctly
    if (splitDocs.length > 0) {
      console.log("Sample content from first chunk:", splitDocs[0].pageContent.substring(0, 200))
    }

    return splitDocs.map(doc => doc.pageContent)
  } catch (error) {
    console.error("Error loading or processing PDF:", error)
    return []
  }
}

export async function createPdfVectorStore(pdfBuffer: ArrayBuffer) {
  const docs = await loadAndProcessPdf(pdfBuffer)
  console.log(`Creating vector store with ${docs.length} documents`)
  
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
  })
  const vectorStore = await MemoryVectorStore.fromTexts(docs, [], embeddings)
  return vectorStore
}

export async function createCsvVectorStore(csvData: any[]) {
  const texts = csvData.map(
    (item) =>
      `Field: ${item.field_label || item.Field || ""}, Instructions: ${item.instructions || item.Instructions || ""}`,
  )

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  })

  const docs = await textSplitter.splitText(texts.join("\n"))
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
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
