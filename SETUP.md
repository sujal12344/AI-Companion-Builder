# AI Companion Builder - Setup Guide

This guide will help you set up the AI Companion Builder with RAG-powered knowledge sources.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- API keys for required services (see below)

## Required API Keys

### 1. Clerk Authentication
- Sign up at https://dashboard.clerk.com
- Create a new application
- Copy your `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

### 2. PostgreSQL Database
Choose one of these providers:
- **Neon** (recommended): https://neon.tech
- **Supabase**: https://supabase.com
- **Railway**: https://railway.app
- Or use your own PostgreSQL instance

Copy your connection string as `DATABASE_URL`

### 3. Pinecone Vector Database
- Sign up at https://app.pinecone.io
- Create a new index with these settings:
  - **Dimensions**: 768
  - **Metric**: cosine
  - **Cloud**: Any
- Copy your API key as `PINECONE_API_KEY`
- Copy your index name as `PINECONE_INDEX` (e.g., "companion")

### 4. Google/Gemini API
- Go to https://aistudio.google.com/app/apikey
- Create an API key
- Use it for both `GOOGLE_API_KEY` and `GEMINI_API_KEY`

### 5. Groq API
- Sign up at https://console.groq.com
- Create an API key
- Copy it as `GROQ_API_KEY`

### 6. YouTube Data API
- Go to https://console.cloud.google.com
- Create a new project
- Enable "YouTube Data API v3"
- Create credentials (API Key)
- Copy it as `YOUTUBE_API_KEY`

### 7. Cloudinary (for image uploads)
- Sign up at https://cloudinary.com
- Go to Dashboard
- Copy `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and create an upload preset
- Copy preset name as `NEXT_PUBLIC_CLOUDINARY_UPLOADPRESET`

### 8. Stripe (for payments)
- Sign up at https://dashboard.stripe.com
- Get your test keys: `STRIPE_SECRET_KEY`
- Set up webhook endpoint: `/api/webhook`
- Copy webhook secret as `STRIPE_WEBHOOK_SECRET`

### 9. Upstash Redis (for chat history)
- Sign up at https://console.upstash.com
- Create a Redis database
- Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 10. Upstash QStash (optional, for background jobs)
- Go to https://console.upstash.com/qstash
- Copy `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- **Note**: If not configured, jobs will run synchronously (good for development)

## Installation

1. **Clone and install dependencies**
```bash
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
```
Then fill in all the required API keys in `.env`

3. **Set up the database**
```bash
npm run db:push
```

4. **Seed categories (optional)**
```bash
npm run db:seed
```

5. **Run the development server**
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Creating Your First Knowledge Companion

1. **Create a companion**
   - Go to the home page
   - Click "Create" or navigate to `/companion/new`
   - Fill in basic information (name, description, category, image)
   - Add instructions and example conversation
   - Click "Create your companion"

2. **Add knowledge sources**
   - Edit your companion
   - Scroll to "Knowledge Sources (New)" section
   - Click "Add Source"
   - Choose source type:
     - **YouTube**: Paste channel, video, or playlist URL
     - **Website**: Paste website or blog URL
     - **Text**: Paste text content directly

3. **Wait for ingestion**
   - Sources will show processing status
   - YouTube channels may take time depending on video count
   - Check progress bars and status badges

4. **Chat with your companion**
   - Navigate to the chat page
   - Ask questions based on the ingested content
   - See source citations with each response
   - Click timestamp links for YouTube videos

## Features

### Supported Source Types

- ✅ **YouTube Channels**: Automatically discovers all videos
- ✅ **YouTube Videos**: Individual video transcripts
- ✅ **YouTube Playlists**: All videos in a playlist
- ✅ **Websites**: Sitemap, RSS, and crawling support
- ✅ **Text Content**: Manually pasted content
- 🚧 **Files**: PDF, DOCX, TXT, CSV, JSON (via legacy upload)

### Key Capabilities

- **Automatic transcript extraction** from YouTube videos
- **Sitemap and RSS discovery** for websites
- **Source-aware chunking** optimized per content type
- **Timestamp preservation** for YouTube content
- **Citation tracking** with clickable source links
- **Background processing** with progress tracking
- **Incremental updates** (avoid re-processing)

## Troubleshooting

### YouTube videos show "NEEDS_TRANSCRIPT"
- Not all YouTube videos have transcripts available
- Videos without transcripts use title/description
- Creators can add transcripts manually

### Website ingestion fails
- Some websites block automated access
- Try the manual text paste option instead
- Check if the site has a sitemap.xml or RSS feed

### QStash errors in logs
- QStash is optional for development
- Jobs will run synchronously without it
- Only required for production scale

### Embedding/Pinecone errors
- Verify your Pinecone index has 768 dimensions
- Check that metric is set to "cosine"
- Ensure API key is correct

### Chat responses don't use sources
- Check that sources have status "READY"
- Verify vectors were created in Pinecone
- Try asking questions related to ingested content

## Architecture

- **Frontend**: Next.js 15, React, TailwindCSS, shadcn/ui
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: PostgreSQL (companion, sources, documents)
- **Vector DB**: Pinecone (embeddings for RAG)
- **Embeddings**: Google Gemini text-embedding-004
- **LLM**: Groq (llama-3.3-70b-versatile)
- **Auth**: Clerk
- **Payments**: Stripe
- **Background Jobs**: Upstash QStash (optional)
- **Cache**: Upstash Redis

## Production Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

**Important**: Set up webhook URLs for:
- Stripe: `/api/webhook`
- QStash worker: `/api/worker/ingest`

### Environment Variables for Production
- Update `NEXT_PUBLIC_APP_URL` to your domain
- Use production API keys (not test keys)
- Configure QStash for background processing

## License

See LICENSE file for details.
