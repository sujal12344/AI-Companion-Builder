# System Architecture - AI Companion Builder

## 📋 Table of Contents
1. [High-Level Overview](#high-level-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Layers](#technology-layers)
4. [Data Flow](#data-flow)
5. [Component Architecture](#component-architecture)
6. [API Architecture](#api-architecture)
7. [Database Architecture](#database-architecture)
8. [AI/ML Pipeline](#aiml-pipeline)
9. [Security Architecture](#security-architecture)
10. [Deployment Architecture](#deployment-architecture)

---

## High-Level Overview

AI Companion Builder ek modern **3-tier SaaS architecture** hai:

```
┌─────────────────────────────────────────────────┐
│         PRESENTATION LAYER (Frontend)           │
│  Next.js 15, React 18, TailwindCSS, Shadcn UI  │
└─────────────────────────────────────────────────┘
                      ↓ ↑
┌─────────────────────────────────────────────────┐
│         APPLICATION LAYER (Backend)             │
│   Next.js API Routes, Prisma ORM, Business Logic│
└─────────────────────────────────────────────────┘
                      ↓ ↑
┌─────────────────────────────────────────────────┐
│            DATA LAYER (Storage)                 │
│  PostgreSQL, Pinecone, Redis, File System       │
└─────────────────────────────────────────────────┘
                      ↓ ↑
┌─────────────────────────────────────────────────┐
│         EXTERNAL SERVICES LAYER                 │
│  Clerk, Stripe, Groq, Cloudinary, Google AI     │
└─────────────────────────────────────────────────┘
```

---

## Architecture Diagram

### System Architecture Diagram

```

┌──────────────────────────────────────────────────────────────────┐
│                          USER / CLIENT                           │
│                     (Browser / Mobile Device)                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌──────────────────────────────────────────────────────────────────┐
│                   NEXT.JS APPLICATION SERVER                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            SERVER COMPONENTS (SSR/SSG)                     │ │
│  │  • RootPage (Home)    • ChatPage    • CompanionPage       │ │
│  │  • SettingsPage       • StorePage                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            CLIENT COMPONENTS (Hydrated)                    │ │
│  │  • Navbar    • Sidebar    • ChatClient                    │ │
│  │  • CompanionForm    • SearchInput                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   API ROUTES                               │ │
│  │  • /api/chat/[chatId]      • /api/companion               │ │
│  │  • /api/stripe             • /api/webhook                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
       ↓ ↑              ↓ ↑              ↓ ↑              ↓ ↑
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Clerk      │  │   Stripe     │  │  Cloudinary  │  │  File System │
│ (Auth/Users) │  │ (Payments)   │  │   (Images)   │  │  (Documents) │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

       ↓ ↑              ↓ ↑              ↓ ↑              ↓ ↑
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │   Pinecone   │  │    Redis     │  │     Groq     │
│  (Database)  │  │  (Vectors)   │  │   (Cache)    │  │    (LLM)     │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                         ↓ ↑
                  ┌──────────────┐
                  │  Google AI   │
                  │ (Embeddings) │
                  └──────────────┘
```

---

## Technology Layers

### 1. Presentation Layer

**Purpose:** User Interface aur User Experience

**Technologies:**
- **Next.js 15** - React framework with App Router
- **React 18** - UI library with Server Components
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first CSS
- **Shadcn UI** - Component library (Radix UI based)
- **Framer Motion** - Animations

**Responsibilities:**
- Render UI components
- Handle user interactions
- Form validation (client-side)
- State management (Zustand, React Hook Form)
- Routing (App Router)
- SEO optimization

**Component Types:**
- **Server Components:** Data fetching, SEO
- **Client Components:** Interactivity, state
- **Shared Components:** Reusable UI elements

---

### 2. Application Layer

**Purpose:** Business Logic aur API Endpoints

**Technologies:**
- **Next.js API Routes** - Backend endpoints
- **Prisma ORM** - Database queries
- **Zod** - Schema validation
- **Clerk SDK** - Authentication
- **Stripe SDK** - Payment processing

**Responsibilities:**
- Request handling
- Authentication/Authorization
- Input validation
- Business logic execution
- Database operations
- External API calls
- Error handling
- Rate limiting

**Key Modules:**
- **Memory Manager** - Chat history & vector operations
- **Subscription Manager** - Pro status checks
- **Rate Limiter** - API abuse prevention
- **Error Handler** - Consistent error responses

---

### 3. Data Layer

**Purpose:** Data Storage aur Retrieval

**Technologies:**
- **PostgreSQL** - Relational database
- **Pinecone** - Vector database
- **Upstash Redis** - Cache & chat history
- **File System** - Document storage (temporary)

**Data Types:**
- **Structured Data:** PostgreSQL (users, companions, messages)
- **Vector Data:** Pinecone (embeddings)
- **Temporal Data:** Redis (chat history, rate limits)
- **Binary Data:** File system (PDFs, documents)

---

### 4. External Services Layer

**Purpose:** Third-party Integrations

**Services:**
- **Clerk** - Authentication & user management
- **Stripe** - Payment processing
- **Groq** - LLM inference (Llama3)
- **Google AI** - Text embeddings
- **Cloudinary** - Image hosting & CDN

---

## Data Flow

### 1. User Authentication Flow

```
User → Sign In Page
  ↓
Clerk Authentication
  ↓
JWT Token Generated
  ↓
Secure Cookie Set
  ↓
Redirect to App
  ↓
auth() in Server Components
  ↓
Protected Routes Access
```

### 2. Chat Message Flow

```
User types message
  ↓
ChatClient Component (Frontend)
  ├─> Optimistic UI update (local state)
  └─> POST /api/chat/[chatId]
       ↓
     API Route Handler
       ├─> Authentication Check (Clerk)
       ├─> Rate Limit Check (Upstash)
       ├─> Save User Message (Prisma + Redis)
       └─> Process Request
            ↓
         Memory Manager
            ├─> Read Chat History (Redis)
            └─> Vector Search (Pinecone)
                 ├─> Embed Query (Google AI)
                 ├─> Similarity Search
                 └─> Retrieve Top 5 Contexts
            ↓
         Build Prompt
            ├─> System Instructions
            ├─> Retrieved Context
            ├─> Chat History
            └─> User Message
            ↓
         Groq API Call (Llama3)
            ↓
         AI Response Generated
            ↓
         StreamingTextResponse
            ↓
         Save to Database & Redis
            ↓
       Response Stream to Client
         ↓
   ChatClient receives chunks
         ↓
   UI updates incrementally
```

### 3. Companion Creation Flow

```
User fills CompanionForm
  ↓
Upload Image to Cloudinary (Client-side)
  ↓
Upload Documents/Links/Text (Knowledge Base)
  ↓
Submit Form (FormData)
  ↓
POST /api/companion
  ↓
API Route Handler
  ├─> Authentication Check
  ├─> Pro Status Check
  ├─> Validation (Zod)
  └─> Process Request
       ↓
    Create Companion (Prisma)
       ↓
    Process Contexts (Parallel)
       ├─> Files
       │    ├─> Save to File System
       │    ├─> Parse with Langchain Loaders
       │    ├─> Split into Chunks
       │    ├─> Generate Embeddings (Google AI)
       │    └─> Store in Pinecone
       ├─> Links
       │    ├─> Web Scraping (Cheerio)
       │    ├─> Extract Content
       │    ├─> Split into Chunks
       │    ├─> Generate Embeddings
       │    └─> Store in Pinecone
       └─> Text
            ├─> Direct Text Content
            ├─> Split into Chunks
            ├─> Generate Embeddings
            └─> Store in Pinecone
       ↓
    Save Context Metadata (Prisma)
       ↓
    Return Companion Object
       ↓
    Redirect to Home
```

### 4. Subscription Flow

```
User clicks "Upgrade to Pro"
  ↓
POST /api/stripe
  ↓
Check Existing Subscription
  ↓
Create Stripe Checkout Session
  ├─> Line items: Pro subscription
  ├─> Success URL: /settings
  └─> Cancel URL: /settings
  ↓
Redirect to Stripe Checkout
  ↓
User completes payment
  ↓
Stripe sends Webhook
  ↓
POST /api/webhook
  ↓
Verify Webhook Signature
  ↓
Handle Event
  ├─> checkout.session.completed
  │    └─> Create UserSubscription record
  └─> invoice.payment_succeeded
       └─> Update subscription end date
  ↓
User redirected to success page
  ↓
checkSubscription() returns true
  ↓
Pro features unlocked
```

---

## Component Architecture

### Frontend Component Hierarchy

```
RootLayout (Server)
  ├─> ClerkProvider
  ├─> ThemeProvider
  ├─> ProModal (Global)
  └─> Toaster (Global)

RootLayout (Root Routes)
  ├─> Navbar (Client)
  │    ├─> Logo
  │    ├─> MobileNav
  │    ├─> ModeToggle
  │    └─> AuthButtons
  ├─> Sidebar (Client)
  │    └─> Route Links
  └─> Main Content
       └─> Page Components

HomePage (Server)
  ├─> SearchInput (Client)
  ├─> Categories (Server)
  └─> Companions (Server)
       └─> CompanionCard[] (Client)

ChatPage (Server)
  └─> ChatClient (Client)
       ├─> ChatHeader (Client)
       ├─> ChatMessages (Client)
       │    └─> ChatMessage[] (Client)
       └─> Input (Client)

CompanionPage (Server)
  └─> CompanionForm (Client)
       ├─> ImageUpload (Client)
       ├─> Form Fields (Client)
       └─> ContextUpload (Client)
```

### Component Responsibilities

**Server Components:**
- Data fetching from database
- Authentication checks
- SEO metadata
- Initial page render
- No JavaScript to client

**Client Components:**
- User interactions
- State management
- Form handling
- API calls
- Animations
- Event handlers

**Shared Components:**
- UI elements (Button, Input, etc.)
- Layout components
- Utility components

---

## API Architecture

### RESTful API Design

**Endpoint Structure:**
```
/api/companion
  ├─> POST    - Create companion
  └─> /[id]
       ├─> GET    - Get companion (if needed)
       ├─> PATCH  - Update companion
       └─> DELETE - Delete companion

/api/chat/[chatId]
  └─> POST    - Send message & get response

/api/stripe
  └─> POST    - Create checkout session

/api/webhook
  └─> POST    - Handle Stripe webhooks
```

### API Route Structure

Every API route follows this pattern:

```typescript
export async function POST(request: Request) {
  try {
    // 1. Authentication
    const user = await currentUser();
    if (!user) return unauthorized();
    
    // 2. Authorization
    const hasAccess = await checkAccess(user);
    if (!hasAccess) return forbidden();
    
    // 3. Input Validation
    const body = await request.json();
    const validated = schema.parse(body);
    
    // 4. Rate Limiting
    const { success } = await rateLimit(identifier);
    if (!success) return tooManyRequests();
    
    // 5. Business Logic
    const result = await processRequest(validated);
    
    // 6. Response
    return NextResponse.json(result);
    
  } catch (error) {
    // 7. Error Handling
    console.error("[API_ERROR]", error);
    return internalServerError();
  }
}
```

### Error Response Standard

```typescript
{
  error: string;        // Error message
  code: string;         // Error code (optional)
  statusCode: number;   // HTTP status
}
```

### Success Response Standard

```typescript
{
  data: T;             // Response data
  message?: string;    // Success message (optional)
}
```

---

## Database Architecture

### Entity Relationship Diagram

```
┌─────────────┐
│  Category   │
│─────────────│
│ id (PK)     │
│ name        │
└─────────────┘
       │ 1
       │
       │ N
┌─────────────────────┐
│    Companion        │
│─────────────────────│
│ id (PK)             │
│ userId              │
│ userName            │
│ name                │
│ description         │
│ img                 │
│ instructions        │
│ seed                │
│ categoryId (FK)     │
│ createdAt           │
│ updatedAt           │
└─────────────────────┘
       │ 1           │ 1
       │             │
       │ N           │ N
┌─────────────┐  ┌──────────────────┐
│   Message   │  │ CompanionContext │
│─────────────│  │──────────────────│
│ id (PK)     │  │ id (PK)          │
│ role        │  │ type             │
│ content     │  │ title            │
│ userId      │  │ content          │
│ companionId │  │ fileName         │
│ created     │  │ filePath         │
│ updatedAt   │  │ url              │
└─────────────┘  │ companionId (FK) │
                 │ createdAt        │
                 │ updatedAt        │
                 └──────────────────┘

┌──────────────────────┐
│  UserSubscription    │
│──────────────────────│
│ id (PK)              │
│ userId (Unique)      │
│ stripeCustomerId     │
│ stripeSubscriptionId │
│ stripePriceId        │
│ stripeCurrentPeriodEnd│
└──────────────────────┘
```

### Database Relationships

1. **Category → Companion** (One-to-Many)
   - One category has many companions
   - Companion belongs to one category

2. **Companion → Message** (One-to-Many with Cascade)
   - One companion has many messages
   - Message belongs to one companion
   - **Cascade delete:** Companion delete → Messages delete

3. **Companion → CompanionContext** (One-to-Many with Cascade)
   - One companion has many contexts
   - Context belongs to one companion
   - **Cascade delete:** Companion delete → Contexts delete

4. **User → UserSubscription** (One-to-One)
   - One user has one subscription
   - Unique constraint on userId

### Indexes

```sql
-- Companion table
CREATE INDEX idx_companion_categoryId ON Companion(categoryId);
CREATE INDEX idx_companion_userId ON Companion(userId);

-- Message table
CREATE INDEX idx_message_companionId ON Message(companionId);
CREATE INDEX idx_message_userId ON Message(userId);

-- CompanionContext table
CREATE INDEX idx_context_companionId ON CompanionContext(companionId);
```

---

## AI/ML Pipeline


### RAG (Retrieval Augmented Generation) Architecture

```
┌─────────────────────────────────────────────────┐
│         DOCUMENT INGESTION PIPELINE             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  1. Document Loading                            │
│     ├─> PDFLoader (pdf-parse)                   │
│     ├─> DocxLoader (mammoth)                    │
│     ├─> CSVLoader                               │
│     ├─> JSONLoader                              │
│     ├─> TextLoader                              │
│     └─> WebScraper (cheerio)                    │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. Text Splitting                              │
│     RecursiveCharacterTextSplitter              │
│     • Chunk Size: 1000 characters               │
│     • Overlap: 200 characters                   │
│     • Smart splitting (paragraphs, sentences)   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. Embedding Generation                        │
│     GoogleGenerativeAIEmbeddings                │
│     • Model: text-embedding-004                 │
│     • Dimensions: 768                           │
│     • Rate limiting: Batch processing           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  4. Vector Storage                              │
│     Pinecone Database                           │
│     • Namespace: companion-knowledge            │
│     • Metadata: {                               │
│         companionId, source, type, chunkIndex   │
│       }                                         │
└─────────────────────────────────────────────────┘
```

### Query Pipeline

```
┌─────────────────────────────────────────────────┐
│         USER QUERY PROCESSING                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  1. Query Embedding                             │
│     • Embed user question (Google AI)           │
│     • Same model as documents                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. Vector Similarity Search                    │
│     Pinecone Query                              │
│     • topK: 5                                   │
│     • Filter: companionId                       │
│     • includeMetadata: true                     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. Context Ranking                             │
│     Sort by Similarity Score                    │
│     • 0.9+ : Highly relevant                    │
│     • 0.7-0.9 : Relevant                        │
│     • <0.7 : Less relevant                      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  4. Prompt Construction                         │
│     Combine:                                    │
│     • System Instructions                       │
│     • Retrieved Context (Top 5)                 │
│     • Chat History (Last 10)                    │
│     • Current User Query                        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  5. LLM Generation                              │
│     Groq API (Llama3-8b-8192)                   │
│     • Temperature: 0.7                          │
│     • Max Tokens: 2048                          │
│     • Streaming: true                           │
└─────────────────────────────────────────────────┘
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────┐
│  1. AUTHENTICATION LAYER                        │
│     • Clerk JWT tokens                          │
│     • Secure session cookies                    │
│     • Automatic token refresh                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. AUTHORIZATION LAYER                         │
│     • User ownership checks                     │
│     • Pro subscription verification             │
│     • Resource-level permissions                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. VALIDATION LAYER                            │
│     • Zod schema validation                     │
│     • Input sanitization                        │
│     • Type checking                             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  4. RATE LIMITING LAYER                         │
│     • Upstash Rate Limit                        │
│     • Per-user limits                           │
│     • Sliding window algorithm                  │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  5. DATA PROTECTION LAYER                       │
│     • Environment variables                     │
│     • HTTPS encryption                          │
│     • CSRF protection                           │
│     • SQL injection prevention (Prisma)         │
└─────────────────────────────────────────────────┘
```

### Authentication Flow Details

```typescript
// Server Component
const { userId } = await auth();
if (!userId) redirect("/sign-in");

// API Route
const user = await currentUser();
if (!user) return NextResponse.json("Unauthorized", { status: 401 });

// Authorization
const companion = await prisma.companion.findUnique({
  where: { id, userId }
});
if (!companion) return NextResponse.json("Forbidden", { status: 403 });
```

### Rate Limiting Implementation

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
  analytics: true,
});

const identifier = `${userId}-${companionId}`;
const { success } = await ratelimit.limit(identifier);

if (!success) {
  return NextResponse.json("Rate limit exceeded", { status: 429 });
}
```

---

## Deployment Architecture

### Production Deployment

```
┌─────────────────────────────────────────────────┐
│                   VERCEL                        │
│  ┌───────────────────────────────────────────┐ │
│  │     Next.js Application                   │ │
│  │  • Edge Functions                         │ │
│  │  • Server Components                      │ │
│  │  • API Routes                             │ │
│  │  • Static Assets                          │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
            ↓ ↑            ↓ ↑            ↓ ↑
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│  Neon/Supabase  │  │  Cloudinary  │  │   Clerk      │
│  (PostgreSQL)   │  │   (Images)   │  │  (Auth)      │
└─────────────────┘  └──────────────┘  └──────────────┘
            ↓ ↑            ↓ ↑            ↓ ↑
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│    Pinecone     │  │   Upstash    │  │    Stripe    │
│   (Vectors)     │  │   (Redis)    │  │  (Payments)  │
└─────────────────┘  └──────────────┘  └──────────────┘
            ↓ ↑            ↓ ↑
┌─────────────────┐  ┌──────────────┐
│      Groq       │  │  Google AI   │
│     (LLM)       │  │ (Embeddings) │
└─────────────────┘  └──────────────┘
```

### Environment Variables

```env
# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# AI Services
GROQ_API_KEY=
GEMINI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=

# Cache & Rate Limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Storage
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=

# Payments
STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=
```

### CI/CD Pipeline

```
GitHub Repository
       ↓
  Push to main branch
       ↓
Vercel detects change
       ↓
┌─────────────────────┐
│  1. Build Phase     │
│  • npm install      │
│  • prisma generate  │
│  • npm run build    │
└─────────────────────┘
       ↓
┌─────────────────────┐
│  2. Test Phase      │
│  • Type checking    │
│  • Linting          │
│  • Build validation │
└─────────────────────┘
       ↓
┌─────────────────────┐
│  3. Deploy Phase    │
│  • Deploy to edge   │
│  • Assign domain    │
│  • Enable SSL       │
└─────────────────────┘
       ↓
Production Live ✅
```

---

## Scalability Considerations

### Current Bottlenecks & Solutions

**1. File Storage**
- **Current:** Local file system
- **Solution:** AWS S3 / Cloudflare R2
- **Benefits:** Distributed storage, CDN, durability

**2. Document Processing**
- **Current:** Synchronous processing
- **Solution:** Queue system (Bull/BullMQ + Redis)
- **Benefits:** Async processing, retry logic, scaling

**3. Database**
- **Current:** Single PostgreSQL instance
- **Solution:** Read replicas, connection pooling
- **Benefits:** Better read performance, high availability

**4. API Rate Limiting**
- **Current:** Per-route limiting
- **Solution:** Per-tier limiting with grace periods
- **Benefits:** Fair usage, better UX

**5. Vector Search**
- **Current:** Query on every chat message
- **Solution:** Semantic caching, query deduplication
- **Benefits:** Reduced costs, faster responses

### Horizontal Scaling Strategy

```
Load Balancer
       ↓
┌──────────────────────────────────┐
│  Next.js Instance 1              │
│  Next.js Instance 2              │
│  Next.js Instance 3              │
│  ...                             │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│  Database Pool                   │
│  • Primary (writes)              │
│  • Replica 1 (reads)             │
│  • Replica 2 (reads)             │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│  Redis Cluster                   │
│  • Node 1                        │
│  • Node 2                        │
│  • Node 3                        │
└──────────────────────────────────┘
```

---

## Monitoring & Observability

### Metrics to Track

**Application Metrics:**
- Request latency (P50, P95, P99)
- Error rate by endpoint
- Request throughput (req/sec)
- Active users
- Subscription conversions

**Infrastructure Metrics:**
- CPU usage
- Memory usage
- Database connections
- Cache hit rate
- API quota usage (Groq, Pinecone)

**Business Metrics:**
- New companions created
- Messages sent
- Active subscriptions
- Revenue (MRR, ARR)

### Logging Strategy

```typescript
// Structured logging
console.log({
  level: 'info',
  message: 'Chat message processed',
  userId,
  companionId,
  duration: endTime - startTime,
  timestamp: new Date().toISOString()
});

// Error logging
console.error({
  level: 'error',
  message: 'Vector search failed',
  error: error.message,
  stack: error.stack,
  userId,
  companionId
});
```

### Recommended Tools

- **Error Tracking:** Sentry
- **Performance:** Vercel Analytics, New Relic
- **Logging:** LogRocket, DataDog
- **Uptime:** UptimeRobot, Pingdom
- **Database:** Prisma Studio, pgAdmin

---

## Conclusion

Ye architecture design kiya gaya hai:
- **Scalability** - Horizontal scaling ready
- **Maintainability** - Clear separation of concerns
- **Security** - Multiple security layers
- **Performance** - Caching, indexing, streaming
- **Reliability** - Error handling, retry logic
- **Developer Experience** - Type safety, clear patterns

Future enhancements ke liye room hai while maintaining core architecture principles.
