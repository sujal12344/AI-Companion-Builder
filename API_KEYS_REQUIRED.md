# API Keys Required for Different Features

## Core Features (Required for Basic App to Run)

### ✅ Must Have
1. **CLERK_SECRET_KEY** & **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY**
   - For user authentication
   - Get from: https://dashboard.clerk.com
   
2. **DATABASE_URL**
   - PostgreSQL connection
   - Get from: Neon, Supabase, Railway, or local PostgreSQL
   
3. **UPSTASH_REDIS_REST_URL** & **UPSTASH_REDIS_REST_TOKEN**
   - For chat history and rate limiting
   - Get from: https://console.upstash.com
   
4. **GROQ_API_KEY**
   - For AI chat responses
   - Get from: https://console.groq.com

## Knowledge Source Features (Required for RAG)

### For YouTube Sources
- **YOUTUBE_API_KEY** or **GOOGLE_API_KEY**
  - Required for YouTube channel/video discovery
  - Get from: https://console.cloud.google.com
  - Enable "YouTube Data API v3"
  - **Without this**: YouTube connector will fail

### For Embeddings & Vector Search
- **GEMINI_API_KEY** (same as GOOGLE_API_KEY)
  - For creating text embeddings
  - Get from: https://aistudio.google.com/app/apikey
  - **Without this**: Cannot create embeddings, chat won't use sources

- **PINECONE_API_KEY** & **PINECONE_INDEX**
  - For vector storage and similarity search
  - Get from: https://app.pinecone.io
  - Create index with: dimensions=768, metric=cosine
  - **Without this**: Cannot store/retrieve embeddings

### For Website/Text Sources
- **No API keys needed!**
  - Website scraping works without API keys
  - Text paste works without API keys
  - Only needs GEMINI_API_KEY for embedding the content

## Optional Features

### Background Job Processing (Optional)
- **QSTASH_TOKEN**, **QSTASH_CURRENT_SIGNING_KEY**, **QSTASH_NEXT_SIGNING_KEY**
  - For async background processing
  - Get from: https://console.upstash.com/qstash
  - **Without this**: Jobs run synchronously (slower but works)

### Payments (Optional)
- **STRIPE_SECRET_KEY** & **STRIPE_WEBHOOK_SECRET**
  - For subscription billing
  - Get from: https://dashboard.stripe.com
  - **Without this**: Payment features won't work

### Image Uploads (Optional)
- **NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME** & **NEXT_PUBLIC_CLOUDINARY_UPLOADPRESET**
  - For companion image uploads
  - Get from: https://cloudinary.com
  - **Without this**: Cannot upload custom images

## Quick Start - Minimum Setup

For testing the RAG system, you need:

1. ✅ Clerk (auth)
2. ✅ PostgreSQL (database)
3. ✅ Upstash Redis (chat history)
4. ✅ Groq (LLM)
5. ✅ Google/Gemini (embeddings)
6. ✅ Pinecone (vector DB)
7. ✅ YouTube API (for YouTube sources)

**For just text sources**: Skip #7, paste content directly.

## What Works Without All Keys?

- ✅ User authentication (needs Clerk)
- ✅ Creating companions (needs DB)
- ✅ Basic chat (needs Groq + Redis)
- ✅ Text paste sources (needs Gemini + Pinecone)
- ✅ Website sources (needs Gemini + Pinecone)
- ❌ YouTube sources (needs YouTube API + Gemini + Pinecone)
- ❌ Background jobs (needs QStash or runs sync)
- ❌ Payments (needs Stripe)
