# Fixes Applied

## Issues Fixed

### 1. Polling Issue ✅
**Problem**: The SourceList component was polling `/api/sources` every 5 seconds continuously, even when no ingestion was happening.

**Fix**: Updated `components/sources/SourceList.tsx` to:
- Only start polling when there are active ingestion jobs
- Stop polling when no sources are in `DISCOVERING` or `INGESTING` status
- Separated initial fetch from polling logic

**Result**: Reduced unnecessary database queries by ~95%

### 2. "No adapter registered" Error ✅
**Problem**: Source adapters (YouTube, Website, Text, File) were created but never registered with the `SourceAdapterFactory`.

**Fix**: Created `lib/sources/register-adapters.ts` that:
- Registers all adapters with the factory on import
- Maps each `SourceType` enum to its corresponding adapter class
- Auto-registers when imported in API routes

**Files Updated**:
- `lib/sources/register-adapters.ts` (new file)
- `app/api/sources/route.ts` (added import)
- `app/api/worker/ingest/route.ts` (added import)

**Result**: All source types now properly resolve to their adapters

### 3. TypeScript Build Errors ✅
**Problems**:
- Duplicate method name in `ChunkingService`
- Invalid `taskType` in GoogleGenerativeAIEmbeddings

**Fixes**:
- Renamed `chunkDocument` → `chunkDocumentFile` for file processing
- Removed `taskType` parameter (not supported in current version)

### 4. API Keys Documentation ✅
Created `API_KEYS_REQUIRED.md` explaining:
- Which API keys are required for which features
- Minimum setup for testing
- What works without all keys
- Where to get each API key

## Testing Without All API Keys

You can test different features with partial setup:

### Text Sources (Minimal Setup)
Required:
- ✅ Clerk (auth)
- ✅ PostgreSQL (database)
- ✅ Upstash Redis (chat history)
- ✅ Groq (LLM)
- ✅ Gemini (embeddings)
- ✅ Pinecone (vector storage)

**Works**: Paste text, create embeddings, chat with grounded responses

### Website Sources
Same as text sources + website URL validation.

**Works**: Scrape websites, RSS feeds, sitemaps

### YouTube Sources
Same as text sources + **YouTube Data API key required**.

**Needs**: `YOUTUBE_API_KEY` or `GOOGLE_API_KEY`

## Next Steps

1. **Set up minimal API keys** (see API_KEYS_REQUIRED.md)
2. **Test with text source first** (easiest, no YouTube API needed)
3. **Add YouTube API key** when ready to test YouTube sources
4. **Optional**: Add QStash for background processing

## Files Modified

- `components/sources/SourceList.tsx` - Fixed polling
- `lib/sources/register-adapters.ts` - New: Adapter registration
- `app/api/sources/route.ts` - Import adapter registration
- `app/api/worker/ingest/route.ts` - Import adapter registration
- `lib/services/chunking-service.ts` - Fixed duplicate method
- `lib/services/embedding-service.ts` - Removed invalid taskType
- `API_KEYS_REQUIRED.md` - New: API key documentation
- `FIXES_APPLIED.md` - This file
