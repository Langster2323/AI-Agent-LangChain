import { type NextRequest, NextResponse } from "next/server"
import { runAgent } from "@/app/lib/agent"
import { parseCsv } from "@/app/lib/data"
import { join } from "path"
import { readFileSync } from "fs"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const query = formData.get("query") as string
    const uploadedPdf = formData.get("pdf") as File | null
    const uploadedCsv = formData.get("csv") as File | null

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    let pdfBuffer: ArrayBuffer
    let csvData: any[] = []

    // Handle uploaded PDF if provided, otherwise use default
    if (uploadedPdf) {
      const arrayBuffer = await uploadedPdf.arrayBuffer()
      pdfBuffer = arrayBuffer
    } else {
      // Load default PDF file from public directory
      const pdfPath = join(process.cwd(), "public", "FM-5-0.pdf")
      const pdfFile = readFileSync(pdfPath)
      pdfBuffer = pdfFile.buffer.slice(
        pdfFile.byteOffset,
        pdfFile.byteOffset + pdfFile.byteLength
      )
    }

    // Handle uploaded CSV if provided, otherwise use default
    if (uploadedCsv) {
      const csvText = await uploadedCsv.text()
      csvData = parseCsv(csvText)
    } else {
      // Load default CSV file from public directory
      const csvPath = join(process.cwd(), "public", "template_fields.csv")
      const csvText = readFileSync(csvPath, "utf-8")
      csvData = parseCsv(csvText)
    }

    // Get the stream and metadata from the agent
    const { stream, metadata } = await runAgent(query, pdfBuffer, csvData)

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
    console.error("Error in API route:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
