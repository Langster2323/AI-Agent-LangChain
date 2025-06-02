# Army FM 5-0 RAG Application

This is a Retrieval-Augmented Generation (RAG) application built with Next.js that allows users to query information from the Army Field Manual (FM) 5-0 and related form templates. The application uses LangChain.js for document processing and OpenAI's GPT-4 for generating responses.

## Prerequisites

- Node.js 18+ installed
- OpenAI API key
- Army FM 5-0 PDF document
- Template fields CSV file

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd rag-application
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

4. Place your documents in the `public` directory:
   - Copy `FM-5-0.pdf` to `public/FM-5-0.pdf`
   - Copy `template_fields.csv` to `public/template_fields.csv`

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Using the Application

The application allows you to ask questions about:
- Army Field Manual 5-0 content
- Form templates and fields
- Military Decision Making Process (MDMP)
- Staff roles and responsibilities

Example questions you can ask:
- "What are the key principles of planning?"
- "What is the role of the S6 during MDMP?"
- "What fields are required for awards?"
- "How does the planning process work?"

The application will:
1. Search through both the PDF and CSV documents
2. Find relevant information
3. Generate a detailed response based on the found information
4. Show you the context it used to generate the response

## Features

- Semantic search across multiple documents
- Context-aware responses
- Support for both PDF and CSV data sources
- Real-time response generation
- Context preview with source indication

## Technical Stack

- Next.js 14
- LangChain.js
- OpenAI GPT-4
- Tailwind CSS
- TypeScript

## Development

The application is structured as follows:
- `app/api/agent/route.ts` - API endpoint for handling queries
- `app/lib/agent.ts` - Core agent logic for processing queries
- `app/lib/data.ts` - Document processing and vector store creation
- `app/page.tsx` - Main application interface

## Contributing

Feel free to submit issues and enhancement requests!

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
