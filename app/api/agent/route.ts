import { type NextRequest, NextResponse } from "next/server"
import { runAgent } from "@/app/lib/agent"
import { parseCsv } from "@/app/lib/data"
import { join } from "path"
import { readFileSync } from "fs"

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // Load PDF file from public directory
    const pdfPath = join(process.cwd(), "public", "FM-5-0.pdf")
    const pdfBuffer = readFileSync(pdfPath)
    const pdfArrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    )

    // Load CSV file from public directory
    const csvPath = join(process.cwd(), "public", "template_fields.csv")
    const csvText = readFileSync(csvPath, "utf-8")
    const csvData = parseCsv(csvText)

    // Get the stream and metadata from the agent
    const { stream, metadata } = await runAgent(query, pdfArrayBuffer, csvData)

    // Create a new stream that includes the metadata
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata first
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: "metadata", data: metadata }) + "\n"))
          
          // Then pipe the AI response stream
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ""
            if (content) {
              controller.enqueue(new TextEncoder().encode(content))
            }
          }
          controller.close()
        } catch (error) {
          console.error("Stream error:", error)
          controller.error(error)
        }
      }
    })

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
