# AI Companion Builder - Complete Documentation

## 📚 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Pages & Routes Flow](#pages--routes-flow)
4. [Components Details](#components-details)
5. [API Routes](#api-routes)
6. [Key Libraries & Technologies](#key-libraries--technologies)
7. [Database Schema](#database-schema)
8. [State Management](#state-management)

---

## Project Overview

**AI Companion Builder** ek SaaS application hai jo users ko apne custom AI companions create karne aur unke saath chat karne ki facility deta hai. Ye Next.js 14, TypeScript, Prisma, aur modern AI technologies (Groq, Langchain, Pinecone) par built hai.

### Core Features:
- 🤖 **Pre-existing AI Models** ke saath chat karo
- ✨ **Custom AI Companions** create karo (Pro Plan)
- 📚 **Knowledge Base** add karo (PDFs, DOCX, TXT, CSV, JSON, Links, Text)
- 🔍 **Search & Filter** companions by name/category
- 💳 **Stripe Integration** for Pro subscription
- 🎨 **Dark/Light Theme** switching
- 🔐 **Clerk Authentication** for secure login

---

## Architecture

### Technology Stack:

**Frontend:**
- Next.js 15.4.10 (App Router)
- React 18
- TypeScript
- TailwindCSS + Shadcn UI
- Framer Motion (animations)
- Zustand (state management)

**Backend:**
- Next.js API Routes
- Prisma ORM
- PostgreSQL Database
- Clerk Authentication
- Stripe Payment Gateway

**AI/ML:**
- Groq SDK (LLM - Llama3)
- Langchain (document processing)
- Pinecone (vector database)
- Google Gemini Embeddings
- Upstash Redis (chat history)

**File Processing:**
- PDF Parser
- DOCX Parser (Mammoth)
- CSV Parser
- Cheerio (web scraping)

---

## Pages & Routes Flow

### 1. **Home Page** (`/`)
**File:** `app/(root)/(routes)/page.tsx`

#### Kya Hota Hai:
- Sabhi available AI companions ka grid display hota hai
- Search functionality available hai
- Categories ke through filter kar sakte ho
- Each companion card clickable hai chat karne ke liye

#### Flow:
1. **Server Component** run hota hai
2. **Prisma** se companions fetch hote hain (categoryId, name filters ke saath)
3. **Categories** fetch hote hain database se
4. **SearchInput**, **Categories**, **Companions** components render hote hain
5. Error handling ke saath **ErrorBoundary** wrapper hai

#### Components Used:
- `SearchInput` - Search functionality
- `Categories` - Category filter chips
- `Companions` - Grid of companion cards
- `CompanionSkeleton` - Loading state
- `ServerErrorFallback` - Error UI

#### Code Flow:
```typescript
RootPage
  ├─> Prisma query (companions + categories)
  ├─> SearchInput component
  ├─> Categories component
  └─> Companions component
       └─> CompanionCard (for each companion)
```

---

### 2. **Chat Page** (`/chat/[chatId]`)
**File:** `app/(chat)/(routes)/chat/[chatId]/page.tsx`

#### Kya Hota Hai:
- Specific companion ke saath chat interface
- Real-time streaming AI responses
- Chat history display
- Message input with placeholders

#### Flow:
1. **Authentication check** (Clerk)
2. **Companion fetch** from database with messages
3. **ChatClient** component render (client-side)
4. User message submit karta hai
5. **API route** call (`/api/chat/[chatId]`)
6. **Memory Manager** chat history retrieve karta hai
7. **Vector Search** relevant context find karta hai
8. **Groq LLM** AI response generate karta hai
9. **Streaming response** user ko dikhta hai
10. **Save to database** aur Redis

#### Components Used:
- `ChatClient` - Main chat interface (client component)
- `ChatHeader` - Companion info header
- `ChatMessages` - Messages list display
- `PlaceholdersAndVanishInput` - Animated input field
- `ChatMessage` - Individual message bubble

#### Code Flow:
```typescript
ChatIdPage (Server)
  ├─> Auth check (Clerk)
  ├─> Fetch companion + messages (Prisma)
  └─> ChatClient (Client Component)
       ├─> ChatHeader
       ├─> ChatMessages
       │    └─> ChatMessage (for each)
       └─> PlaceholdersAndVanishInput
            └─> onSubmit → API call → Stream response
```

---

### 3. **Create/Edit Companion Page** (`/companion/[companionId]`)
**File:** `app/(root)/(routes)/companion/[companionId]/page.tsx`

#### Kya Hota Hai:
- New companion create karo ya existing edit karo
- Image upload (Cloudinary)
- Instructions aur seed conversation add karo
- Knowledge base upload karo (files, links, text)
- Pro subscription required hai

#### Flow:
1. **Authentication check**
2. **Pro subscription check** (redirect if not Pro)
3. **Companion fetch** (if editing)
4. **Categories fetch**
5. **CompanionForm** render hota hai
6. User form fill karta hai
7. **Submit** → FormData create hota hai
8. **API POST/PATCH** to `/api/companion`
9. **Files save** hote hain file system mein
10. **Vector embeddings** create hote hain (Pinecone)
11. **Database save** → Redirect to home

#### Components Used:
- `CompanionForm` - Main form with all fields
- `ImageUpload` - Cloudinary image uploader
- `ContextUpload` - Knowledge base upload
- Form components (Shadcn)

#### Code Flow:
```typescript
CompanionPage (Server)
  ├─> Auth check
  ├─> Pro check
  ├─> Fetch companion (if edit)
  ├─> Fetch categories
  └─> CompanionForm (Client Component)
       ├─> Basic Info (name, description, image)
       ├─> Category selection
       ├─> Instructions (textarea)
       ├─> Seed conversation (textarea)
       ├─> ContextUpload
       │    ├─> PDF/DOCX/TXT/CSV/JSON files
       │    ├─> Web links
       │    └─> Plain text
       └─> Submit → API → Save → Embed → Redirect
```

---

### 4. **Store Page** (`/store`)
**File:** `app/(root)/(routes)/store/page.tsx`

#### Kya Hota Hai:
- User ke khud ke created companions dikhte hain
- Edit/Delete options available
- Same search/filter functionality

#### Flow:
1. **Current user** fetch (Clerk)
2. **Companions filter** by userId
3. Display in grid format

---

### 5. **Settings Page** (`/settings`)
**File:** `app/(root)/(routes)/settings/page.tsx`

#### Kya Hota Hai:
- Current subscription status display
- Features comparison table (Free vs Pro)
- Upgrade/Manage subscription button

#### Flow:
1. **Check subscription** status
2. Display current plan
3. Show features table
4. **SubscriptionButton** component
   - Free user → "Upgrade" button → Stripe checkout
   - Pro user → "Manage" button → Stripe portal

---

## Components Details

### Layout Components:

#### **Navbar** (`components/Navbar.tsx`)
- Logo aur brand name
- Mobile menu toggle
- Theme toggle (dark/light)
- Authentication buttons (Clerk UserButton)
- Upgrade button (if not Pro)

#### **Sidebar** (`components/Sidebar.tsx`)
- Home link
- Create companion (Pro check)
- Settings link
- My Store (Pro check)
- Active route highlighting
- Opens ProModal if not subscribed

#### **MobileSidebar** & **MobileNav**
- Mobile responsive navigation
- Same functionality as Sidebar

---

### Core Components:

#### **SearchInput** (`components/SearchInput.tsx`)
- Real-time search input
- Query params update (`?name=...`)
- Debounced search
- Router refresh

#### **Categories** (`components/Categories.tsx`)
- Category chips display
- Filter by categoryId
- "All" option to clear filter

#### **Companions** (`components/Companions.tsx`)
- Grid layout (responsive)
- Empty state with image
- Maps through companion data

#### **CompanionCard** (`components/CompanionCard.tsx`)
- Individual companion card
- Image, name, description
- Message count display
- Click → Navigate to chat
- Edit/Delete buttons (if owner)

#### **ChatMessages** (`components/ChatMessages.tsx`)
- Scrollable message container
- Auto-scroll to bottom
- Loading indicator
- Maps through messages

#### **ChatMessage** (`components/ChatMessage.tsx`)
- Individual message bubble
- User vs System (AI) styling
- Avatar display (User/Bot)
- Copy message functionality

---

### Form Components:

#### **CompanionForm** (Detail above)
#### **ImageUpload** (`components/ImageUpload.tsx`)
- Cloudinary widget integration
- Image preview
- Upload button

#### **ContextUpload** (`components/ContextUpload.tsx`)
- Multiple context types support
- File upload for documents
- URL input for links
- Text input for plain text
- Add/Remove context items
- Validation

---

### Modal Components:

#### **ProModal** (`components/ProModal.tsx`)
- Zustand store se open/close state
- Features list display
- Stripe checkout redirect
- Animated with framer-motion

#### **SubscriptionButton** (`components/SubscriptionButton.tsx`)
- Pro user → Manage subscription (Stripe portal)
- Free user → Upgrade (Stripe checkout)
- Loading states

---

### UI Components (Shadcn):
- Button, Input, Textarea
- Select, Label, Separator
- Toast, Dialog, Avatar
- Card, Skeleton, Dropdown

---

## API Routes

### 1. **POST `/api/companion`**
**File:** `app/api/companion/route.ts`

#### Purpose:
New companion create karna

#### Flow:
1. **Authentication check** (Clerk)
2. **FormData parse** karo
3. **Validation** (required fields)
4. **Create companion** in database (Prisma)
5. **Process contexts:**
   - Files save karo file system mein
   - **MemoryManager** se embeddings create karo
   - Text contexts → vector embeddings
   - Link contexts → scrape + embeddings
   - Documents → parse + chunk + embeddings
6. **Save contexts** to database
7. Return companion object

#### Technologies:
- Prisma (database)
- Langchain (document processing)
- Pinecone (vector storage)
- File system (fs/promises)

---

### 2. **PATCH `/api/companion/[companionId]`**
**File:** `app/api/companion/[companionId]/route.ts`

#### Purpose:
Existing companion update karna

#### Similar flow as POST

---

### 3. **DELETE `/api/companion/[companionId]`**

#### Purpose:
Companion delete karna

#### Flow:
1. Auth check
2. Delete companion from database (cascade deletes contexts and messages)
3. Clear vector embeddings from Pinecone
4. Delete files from file system

---

### 4. **POST `/api/chat/[chatId]`**
**File:** `app/api/chat/[chatId]/route.ts`

#### Purpose:
AI response generate karna

#### Detailed Flow:

```typescript
1. User message receive karo
   ├─> Authentication check (Clerk)
   ├─> Rate limiting check (Upstash)
   └─> Input validation

2. Save user message
   ├─> Database (Prisma)
   └─> Redis chat history (Upstash)

3. Get relevant context
   ├─> MemoryManager.getInstance()
   ├─> Read latest chat history (Redis)
   └─> Vector search (Pinecone)
        └─> User query ko embed karo
        └─> Similar documents find karo
        └─> Companion-specific filter

4. Generate AI response
   ├─> Build prompt:
   │    ├─> System instructions
   │    ├─> Relevant context from vector DB
   │    └─> Recent chat history
   ├─> Groq API call (Llama3-8b model)
   └─> Stream response

5. Save AI response
   ├─> Database (Prisma)
   ├─> Redis chat history
   └─> Return streaming response to client
```

#### Key Functions:

**getRelevantContext:**
- Vector search in Pinecone
- Returns top 5 relevant documents
- Filtered by companionId

**generateAIResponse:**
- Groq SDK usage
- Prompt construction
- Temperature: 0.7
- Max tokens: 2048
- Model: llama3-8b-8192

---

### 5. **POST `/api/stripe`**
**File:** `app/api/stripe/route.ts`

#### Purpose:
Stripe checkout session create karna

#### Flow:
1. Auth check
2. Check if already subscribed
3. If Pro → Billing portal session
4. If Free → Checkout session
5. Redirect to Stripe

---

### 6. **POST `/api/webhook`**
**File:** `app/api/webhook/route.ts`

#### Purpose:
Stripe webhook events handle karna

#### Events:
- `checkout.session.completed` → Create subscription
- `invoice.payment_succeeded` → Update subscription

---

## Key Libraries & Technologies

### 1. **Clerk (@clerk/nextjs)**
**Purpose:** Authentication & User Management

**Usage:**
- `ClerkProvider` - Root layout wrapper
- `auth()` - Server-side auth
- `currentUser()` - Get user details
- `UserButton` - Pre-built user menu
- Sign-in/Sign-up pages

**Key Points:**
- Session management
- Protected routes
- User metadata
- Webhooks for user events

---

### 2. **Prisma (@prisma/client)**
**Purpose:** Database ORM

**Models:**
- `Category` - Companion categories
- `Companion` - AI companions
- `CompanionContext` - Knowledge base
- `Message` - Chat messages
- `UserSubscription` - Stripe subscriptions

**Key Features:**
- Type-safe queries
- Relations
- Migrations
- Cascade deletes

---

### 3. **Groq SDK (groq-sdk)**
**Purpose:** LLM API (Llama3 model)

**Usage:**
```typescript
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const completion = await groq.chat.completions.create({
  messages: [{ role: "user", content: prompt }],
  model: "llama3-8b-8192",
  temperature: 0.7,
  max_tokens: 2048,
});
```

**Why Groq?**
- Fast inference
- High-quality responses
- Cost-effective
- Llama3 model support

---

### 4. **Langchain (@langchain/core, @langchain/community)**
**Purpose:** Document processing & RAG

**Key Components:**
- `PDFLoader` - PDF parsing
- `DocxLoader` - DOCX parsing
- `CSVLoader` - CSV parsing
- `TextLoader` - Text files
- `RecursiveCharacterTextSplitter` - Chunking
- `GoogleGenerativeAIEmbeddings` - Text embeddings

**RAG Flow:**
1. Load document
2. Split into chunks (1000 chars, 200 overlap)
3. Generate embeddings
4. Store in Pinecone
5. Query time → similarity search

---

### 5. **Pinecone (@pinecone-database/pinecone)**
**Purpose:** Vector Database for RAG

**Usage:**
```typescript
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX);

// Store vectors
await PineconeStore.fromDocuments(docs, embeddings, { pineconeIndex });

// Search
const results = await index.query({
  topK: 5,
  vector: queryVector,
  filter: { companionId },
});
```

**Why Pinecone?**
- Fast similarity search
- Metadata filtering
- Scalable
- Easy integration

---

### 6. **Upstash Redis (@upstash/redis)**
**Purpose:** Chat history storage

**Usage:**
```typescript
const redis = Redis.fromEnv();

// Save message
await redis.zadd(key, { score: Date.now(), member: text });

// Get recent history
const messages = await redis.zrange(key, 0, Date.now(), { byScore: true });
```

**Why Redis?**
- Fast read/write
- Sorted sets for chronological order
- TTL support
- Serverless-friendly

---

### 7. **Upstash Rate Limit (@upstash/ratelimit)**
**Purpose:** API rate limiting

**Usage:**
```typescript
const { success } = await rateLimit(identifier);
if (!success) {
  return NextResponse.json("Rate limit exceeded", { status: 429 });
}
```

**Configuration:**
- Sliding window
- Per user per companion
- Prevents abuse

---

### 8. **Stripe (stripe)**
**Purpose:** Payment processing

**Features:**
- Checkout sessions
- Customer portal
- Webhook events
- Subscription management

**Flow:**
1. User clicks upgrade
2. Create checkout session
3. Redirect to Stripe
4. Payment success → Webhook
5. Update subscription in DB

---

### 9. **Zustand (zustand)**
**Purpose:** Global state management

**Stores:**
- `useProModal` - Pro modal open/close state

**Usage:**
```typescript
const proModal = useProModal();
proModal.onOpen(); // Open modal
proModal.onClose(); // Close modal
```

**Why Zustand?**
- Simple API
- No boilerplate
- TypeScript support
- Small bundle size

---

### 10. **React Hook Form (react-hook-form) + Zod**
**Purpose:** Form handling & validation

**Usage:**
```typescript
const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... }
});
```

**Benefits:**
- Type-safe
- Minimal re-renders
- Built-in validation
- Error handling

---

### 11. **Cloudinary (next-cloudinary)**
**Purpose:** Image uploads

**Usage:**
- Upload widget integration
- Image transformation
- CDN delivery

---

### 12. **Shadcn UI + Radix UI**
**Purpose:** UI component library

**Components:**
- Accessible by default
- Customizable with Tailwind
- Headless UI (Radix)
- Copy-paste approach

---

### 13. **TailwindCSS + Framer Motion**
**Purpose:** Styling & animations

**TailwindCSS:**
- Utility-first CSS
- Dark mode support
- Responsive design

**Framer Motion:**
- Smooth animations
- Page transitions
- Gesture support

---

## Database Schema

### **Category**
```prisma
model Category {
  id         String      @id @default(uuid())
  name       String
  companions Companion[]
}
```

### **Companion**
```prisma
model Companion {
  id           String    @id @default(uuid())
  userId       String
  userName     String
  img          String
  name         String    @db.Text
  description  String    @db.Text
  instructions String?   @db.Text
  seed         String?   @db.Text
  
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  category     Category  @relation(fields: [categoryId], references: [id])
  categoryId   String
  
  messages     Message[]
  contexts     CompanionContext[]
}
```

### **CompanionContext**
```prisma
enum ContextType {
  PDF, DOCX, TXT, JSON, CSV, LINK, TEXT
}

model CompanionContext {
  id          String      @id @default(uuid())
  type        ContextType
  title       String
  
  content     String?     @db.Text  // for TEXT type
  fileName    String?                // for files
  filePath    String?                // for files
  url         String?                // for LINK type
  
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  companion   Companion   @relation(fields: [companionId], references: [id], onDelete: Cascade)
  companionId String
}
```

### **Message**
```prisma
enum Role {
  user
  system
}

model Message {
  id          String    @id @default(uuid())
  role        Role
  content     String    @db.Text
  created     DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  companionId String
  userId      String
  
  companion   Companion @relation(fields: [companionId], references: [id], onDelete: Cascade)
}
```

### **UserSubscription**
```prisma
model UserSubscription {
  id                     String    @id @default(uuid())
  userId                 String    @unique
  stripeCustomerId       String?   @unique
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?   @unique
  stripeCurrentPeriodEnd DateTime?
}
```

---

## State Management

### **Zustand Stores:**

#### `useProModal` (hooks/useProModal.ts)
```typescript
interface ProModalStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}
```

**Usage:**
- Sidebar → Click create (not Pro) → Open modal
- ProModal → Subscribe → Redirect to Stripe

---

### **React Hook Form State:**
- Form values
- Validation errors
- Submit status
- Loading states

---

### **AI SDK State (useCompletion):**
```typescript
const {
  input,           // Current input value
  isLoading,       // Loading state
  setInput,        // Set input value
  handleSubmit,    // Submit handler
  handleInputChange // Input change handler
} = useCompletion({
  api: `/api/chat/${companion.id}`,
  onFinish: (prompt, completion) => {
    // Add message to state
    setMessages([...messages, { role: "system", content: completion }]);
  }
});
```

---

## Error Handling

### **Error Boundaries:**
- `RootErrorBoundary` - Entire app
- `NavbarErrorBoundary` - Navbar component
- `SidebarErrorBoundary` - Sidebar component
- `ContentErrorBoundary` - Main content
- `CompanionErrorBoundary` - Companion grid

### **Try-Catch Blocks:**
- API routes
- Database queries
- External API calls
- File operations

### **Loading States:**
- Skeleton components
- Loading spinners
- Disabled buttons
- Suspense boundaries

---

## Performance Optimizations

1. **Server Components:** Data fetching on server
2. **Streaming:** Real-time AI responses
3. **Caching:** Redis for chat history
4. **Rate Limiting:** Prevent abuse
5. **Lazy Loading:** Suspense boundaries
6. **Vector Search:** Fast similarity search
7. **CDN:** Cloudinary for images
8. **Database Indexing:** Faster queries

---

## Security Features

1. **Authentication:** Clerk
2. **Authorization:** User ownership checks
3. **Rate Limiting:** Upstash
4. **Input Validation:** Zod schemas
5. **CSRF Protection:** Next.js built-in
6. **Environment Variables:** Sensitive data
7. **Stripe Webhooks:** Signature verification

---

## Deployment Considerations

### Environment Variables Required:
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=
DIRECT_URL=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=

# Pinecone
PINECONE_INDEX=
PINECONE_API_KEY=

# Upstash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# AI
GROQ_API_KEY=
GEMINI_API_KEY=

# Stripe
STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=
```

### Build Commands:
```bash
npm install
npx prisma generate
npm run build
npm start
```

---

## Future Enhancements

1. **Voice Chat:** Speech-to-text integration
2. **Image Generation:** AI-generated companion images
3. **Multi-language:** i18n support
4. **Analytics:** Usage tracking
5. **Social Features:** Share companions
6. **Mobile App:** React Native
7. **Collaborative Editing:** Multiple users
8. **Advanced RAG:** Better context retrieval

---

## Conclusion

Ye project modern web development ke best practices follow karta hai:
- Type safety (TypeScript)
- Server-side rendering (Next.js)
- Database ORM (Prisma)
- Authentication (Clerk)
- Payment processing (Stripe)
- AI integration (Groq, Langchain)
- Vector search (Pinecone)
- Real-time features (Streaming, Redis)

Har component ka clear purpose hai aur code maintainable aur scalable hai.
