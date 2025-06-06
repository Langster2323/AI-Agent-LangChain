import * as React from "react"
import { Button } from "@/app/components/ui/atoms/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/organisms/card"
import { FileText, Database, Upload } from "lucide-react"

interface FileUploadProps {
  onFileUpload: (file: File, type: "pdf" | "csv") => void
}

export function FileUpload({ onFileUpload }: FileUploadProps) {
  const [dragActive, setDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file: File) => {
    const fileType = file.type
    if (fileType === "application/pdf") {
      onFileUpload(file, "pdf")
    } else if (fileType === "text/csv" || file.name.endsWith(".csv")) {
      onFileUpload(file, "csv")
    } else {
      alert("Please upload a PDF or CSV file")
    }
  }

  const onButtonClick = () => {
    inputRef.current?.click()
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.csv"
            onChange={handleChange}
          />
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center w-12 h-12 mb-4 bg-gray-100 rounded-full">
              <Upload className="w-6 h-6 text-gray-500" />
            </div>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">PDF or CSV files</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={onButtonClick}
          >
            Select Files
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 