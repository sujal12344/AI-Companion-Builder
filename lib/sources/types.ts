import { SourceType, SourceStatus, ProcessingStatus } from "@prisma/client";

// Common types for source adapters

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  canonicalUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface DiscoveredItem {
  externalId: string; // Platform-specific ID (YouTube video ID, URL hash, etc.)
  title: string;
  description?: string;
  url?: string;
  publishedAt?: Date;
  author?: string;
  duration?: number; // For videos/audio in seconds
  thumbnail?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedDocument {
  externalId: string;
  title: string;
  content: string;
  sourceUrl?: string;
  sourceType: SourceType;
  author?: string;
  publishedAt?: Date;
  language?: string;
  startSeconds?: number; // For video/audio timestamps
  endSeconds?: number;
  metadata: Record<string, unknown>;
  contentHash: string;
}

export interface TranscriptSegment {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface SourceAdapterConfig {
  maxItems?: number;
  dateFrom?: Date;
  dateTo?: Date;
  includePatterns?: string[];
  excludePatterns?: string[];
  // Adapter-specific config
  [key: string]: unknown;
}

// Base interface for all source adapters
export interface SourceAdapter {
  /**
   * Validate the input URL or identifier
   * Resolve canonical URL if applicable
   */
  validate(input: string): Promise<ValidationResult>;

  /**
   * Discover all items from the source
   * Returns metadata about discoverable items (without full content)
   */
  discover(
    sourceId: string,
    input: string,
    config?: SourceAdapterConfig
  ): Promise<DiscoveredItem[]>;

  /**
   * Fetch and normalize a single item's content
   * Convert platform-specific format to normalized document
   */
  fetch(
    item: DiscoveredItem,
    sourceId: string,
    onProgress?: (step: string) => Promise<void>
  ): Promise<NormalizedDocument>;

  /**
   * Generate a stable external ID for an item
   * Used for deduplication and idempotent operations
   */
  getExternalId(item: DiscoveredItem | string): string;

  /**
   * Get the source type this adapter handles
   */
  getSourceType(): SourceType;
}

// Transcript provider interface
export interface TranscriptProvider {
  /**
   * Check if transcript is available for a video
   */
  isAvailable(videoId: string): Promise<boolean>;

  /**
   * Fetch transcript segments with timestamps
   */
  fetchTranscript(videoId: string): Promise<TranscriptSegment[]>;

  /**
   * Get provider name for logging/debugging
   */
  getProviderName(): string;
}

// Chunk types for embedding
export interface DocumentChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  companionId: string;
  sourceId: string;
  documentId: string;
  sourceType: SourceType;
  title: string;
  sourceUrl?: string;
  author?: string;
  publishedAt?: Date;
  chunkIndex: number;
  totalChunks?: number;
  startSeconds?: number;
  endSeconds?: number;
  [key: string]: unknown;
}

// Source selection criteria for UI
export interface SourceSelectionCriteria {
  selectAll?: boolean;
  selectedIds?: string[]; // Selected video IDs, article URLs, etc.
  playlists?: string[];
  latest?: number; // Latest N items
  dateRange?: {
    from: Date;
    to: Date;
  };
  maxDepth?: number; // For website crawling
  maxPages?: number;
  followSitemap?: boolean;
  followRss?: boolean;
}

// Ingestion progress tracking
export interface IngestionProgress {
  sourceId: string;
  stage: IngestionStage;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  currentItem?: string;
  status: SourceStatus;
  errorMessage?: string;
}

export enum IngestionStage {
  VALIDATING = "validating",
  DISCOVERING = "discovering",
  FETCHING = "fetching",
  TRANSCRIBING = "transcribing",
  CHUNKING = "chunking",
  EMBEDDING = "embedding",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Citation format for chat responses
export interface Citation {
  sourceId: string;
  documentId: string;
  title: string;
  sourceType: SourceType;
  sourceUrl?: string;
  author?: string;
  publishedAt?: Date;
  excerpt?: string;
  thumbnail?: string;
  index?: number;
  chunkIndex?: number;
  timestamp?: {
    startSeconds: number;
    endSeconds: number;
    url: string; // Clickable timestamp URL for videos
  };
}
