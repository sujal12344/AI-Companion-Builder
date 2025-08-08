# AI Companion Context Enhancement Feature

## Overview

Enhanced the AI companion creation system to support multiple types of context sources (PDFs, web links, and text content) with RAG (Retrieval-Augmented Generation) capabilities.

## Features Implemented

### 1. Database Schema Updates

- Added `CompanionContext` model to store different types of context
- Added `ContextType` enum (PDF, LINK, TEXT)
- Added relationship between Companion and CompanionContext

### 2. Context Upload Component (`components/ContextUpload.tsx`)

- Support for three context types:
  - **TEXT**: Direct text input about the companion
  - **LINK**: Web URLs that get scraped for content
  - **PDF**: PDF document upload
- Dynamic form based on selected context type
- Context management (add/remove contexts)
- Visual indicators for different context types

### 3. Enhanced CompanionForm

- Integrated ContextUpload component
- Added "Knowledge Base" section
- Support for multipart form data to handle file uploads
- Context state management

### 4. API Routes

- **POST /api/companion**: Create companion with contexts
- **PATCH /api/companion/[id]**: Update companion with contexts
- Support for file uploads and context processing
- Automatic RAG processing for all context types

### 5. Memory Manager Enhancements

- `seedCompanionKnowledgeFromPDF()`: Process PDF documents
- `seedCompanionKnowledgeFromText()`: Process text content
- `seedCompanionKnowledgeFromLinks()`: Process web content
- `clearCompanionEmbeddings()`: Clean up old embeddings
- Enhanced vector search with source attribution

### 6. Web Scraper (`lib/webScraper.ts`)

- Uses Cheerio to extract content from web pages
- Handles text chunking for RAG processing
- Error handling for failed scrapes

### 7. Chat Enhancement

- Automatic context loading during chat
- RAG-powered responses using all context sources
- Source attribution in responses
- Lazy loading of contexts (processed only when needed)

## How It Works

### Context Creation Flow

1. User creates/edits companion
2. User adds context sources (PDFs, links, text)
3. Form submits with multipart data
4. API processes each context type:
   - PDFs: Saved to filesystem and processed with RAG
   - Links: Scraped and processed with RAG
   - Text: Directly processed with RAG
5. Contexts stored in database with processing status

### Chat Flow with RAG

1. User sends message to companion
2. System loads any unprocessed contexts
3. Vector search finds relevant context chunks
4. AI generates response using:
   - Companion instructions
   - Chat history
   - Relevant context from all sources
5. Response includes source attribution

## Context Types

### PDF Documents

- Upload PDF files about the companion
- Automatic text extraction and chunking
- Stored in `companions/` directory
- Example: Upload Elon Musk biography PDF

### Web Links

- Provide URLs with relevant information
- Automatic web scraping using Cheerio
- Content extraction and processing
- Example: Wikipedia page, news articles

### Text Content

- Direct text input about companion
- Manual knowledge addition
- Immediate processing
- Example: Personal notes, facts, quotes

## Benefits

1. **Enhanced Knowledge**: Companions have access to rich, contextual information
2. **Flexible Input**: Multiple ways to provide context
3. **RAG Integration**: Intelligent retrieval of relevant information
4. **Source Attribution**: Users know where information comes from
5. **Scalable**: Can handle large amounts of context data
6. **Optional**: Users can skip context if they prefer basic companions

## Usage Example

Creating an Elon Musk companion:

1. Fill basic info (name, description, instructions)
2. Add contexts:
   - PDF: Upload Elon Musk biography
   - LINK: https://en.wikipedia.org/wiki/Elon_Musk
   - TEXT: "Known for founding SpaceX and Tesla..."
3. Save companion
4. Chat with enhanced knowledge base

The companion will now respond with information from all provided sources, making conversations more accurate and informative.
