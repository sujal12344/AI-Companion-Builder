import { SourceType } from "@prisma/client";
import { DocumentChunk, ChunkMetadata, TranscriptSegment } from "../sources/types";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
// @ts-ignore - compromise doesn't have perfect TypeScript types
import nlp from "compromise";
import { getLogTimestamp } from "../utils";

/**
 * Source-aware chunking service
 * Applies different chunking strategies based on source type
 */
export class ChunkingService {
  /**
   * Chunk document based on source type
   */
  async chunkDocument(
    content: string,
    sourceType: SourceType,
    metadata: Partial<ChunkMetadata>
  ): Promise<DocumentChunk[]> {
    switch (sourceType) {
      case SourceType.YOUTUBE_VIDEO:
      case SourceType.YOUTUBE_CHANNEL:
      case SourceType.YOUTUBE_PLAYLIST:
        return this.chunkYouTubeTranscript(content, metadata);

      case SourceType.WEBSITE:
      case SourceType.RSS_FEED:
        return this.chunkWebContent(content, metadata);

      case SourceType.FILE_UPLOAD:
        return this.chunkDocumentFile(content, metadata);

      case SourceType.TEXT_PASTE:
        return this.chunkTextContent(content, metadata);

      default:
        return this.chunkGeneric(content, metadata);
    }
  }

  /**
   * Chunk YouTube transcript with semantic boundaries
   * Uses ENGLISH translated content for optimal RAG quality
   * Creates smaller chunks (300-500 chars, 2-3 sentences) for better semantic search
   */
  private async chunkYouTubeTranscript(
    content: string,
    metadata: Partial<ChunkMetadata>
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const chunkStartTime = Date.now();
    
    console.log(`\n${getLogTimestamp()} 📦 [CHUNKING] Starting YouTube transcript chunking...`);
    console.log(`${getLogTimestamp()} 📊 [CHUNKING] Input: ${content.length} characters, ${content.split(/\s+/).length} words`);
    console.log(`${getLogTimestamp()} 📄 [CHUNKING] Content preview: "${content.substring(0, 120)}..."`);
    
    const transcriptSegments = metadata.transcriptSegments as TranscriptSegment[] | undefined;

    if (transcriptSegments && transcriptSegments.length > 0) {
      console.log(`${getLogTimestamp()} ⏱️  [CHUNKING] Using timestamp-aware chunking with English content (${transcriptSegments.length} segments)`);
      
      // OPTIMAL RAG CHUNK SIZE: 50-100 words (300-500 chars)
      // This gives better semantic boundaries for vector search
      const targetWords = 75; // ~400 chars, 2-3 sentences
      
      // Split content by sentences with fast fallback for large transcripts to keep event loop responsive
      let sentences: string[] = [];
      try {
        if (content.length < 25000) {
          const doc = nlp(content);
          sentences = doc.sentences().out("array") as string[];
        } else {
          // For massive transcripts (>25k chars, 2+ hr videos), use high-speed boundary tokenizer (1ms vs 800ms)
          sentences = content.match(/[^.!?\n।]+[.!?\n।]+|[^.!?\n।]+$/g) || [content];
        }
      } catch (_) {
        sentences = content.match(/[^.!?\n।]+[.!?\n।]+|[^.!?\n।]+$/g) || [content];
      }
      
      console.log(`   ${getLogTimestamp()} 🔍 [NLP] Detected ${sentences.length} sentences in English content`);
      
      // Calculate approx chars per segment for timestamp mapping
      const charsPerSegment = content.length / transcriptSegments.length;
      
      let currentChunk: string[] = [];
      let currentWordCount = 0;
      let currentCharCount = 0;
      let chunkIndex = 0;
      
      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        const sentenceWords = trimmedSentence.split(/\s+/).length;
        const sentenceChars = trimmedSentence.length;
        
        // Create new chunk if target size reached
        if (currentWordCount + sentenceWords > targetWords && currentChunk.length > 0) {
          const chunkText = currentChunk.join(" ");
          
          // Calculate timestamps based on position in content
          const approxSegmentIndex = Math.floor(currentCharCount / charsPerSegment);
          const startSeconds = transcriptSegments[Math.max(0, approxSegmentIndex)]?.startSeconds || 0;
          const endSegmentIndex = Math.min(
            Math.floor((currentCharCount + chunkText.length) / charsPerSegment),
            transcriptSegments.length - 1
          );
          const endSeconds = transcriptSegments[endSegmentIndex]?.endSeconds || transcriptSegments[transcriptSegments.length - 1].endSeconds;
          
          console.log(`   ${getLogTimestamp()} 📦 [CHUNKING] Chunk ${chunkIndex + 1}: ${chunkText.length} chars, ${currentWordCount} words, ${this.formatTimestamp(startSeconds)} - ${this.formatTimestamp(endSeconds)}`);
          console.log(`      Preview: "${chunkText.substring(0, 90)}..."`);
          
          chunks.push({
            content: chunkText,
            metadata: {
              ...metadata,
              chunkIndex,
              startSeconds,
              endSeconds,
              totalChunks: undefined,
            } as ChunkMetadata,
          });

          currentChunk = [];
          currentWordCount = 0;
          currentCharCount += chunkText.length;
          chunkIndex++;
        }

        currentChunk.push(trimmedSentence);
        currentWordCount += sentenceWords;
      }

      // Add remaining chunk
      if (currentChunk.length > 0) {
        const chunkText = currentChunk.join(" ");
        
        const approxSegmentIndex = Math.floor(currentCharCount / charsPerSegment);
        const startSeconds = transcriptSegments[Math.max(0, approxSegmentIndex)]?.startSeconds || 0;
        const endSeconds = transcriptSegments[transcriptSegments.length - 1].endSeconds;
        
        console.log(`   ${getLogTimestamp()} 📦 [CHUNKING] Chunk ${chunkIndex + 1} (final): ${chunkText.length} chars, ${currentWordCount} words, ${this.formatTimestamp(startSeconds)} - ${this.formatTimestamp(endSeconds)}`);
        console.log(`      Preview: "${chunkText.substring(0, 90)}..."`);
        
        chunks.push({
          content: chunkText,
          metadata: {
            ...metadata,
            chunkIndex,
            startSeconds,
            endSeconds,
            totalChunks: undefined,
          } as ChunkMetadata,
        });
      }
      
      chunks.forEach(chunk => {
        chunk.metadata.totalChunks = chunks.length;
      });
      
    } else {
      console.log(`${getLogTimestamp()} 📝 [CHUNKING] Using NLP-based text chunking (no timestamps)`);
      return this.chunkWithNLP(content, metadata, 75); // 75 words target
    }

    const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(2);
    console.log(`${getLogTimestamp()} ✅ [CHUNKING] Created ${chunks.length} chunks total in ${chunkDuration}s (optimal for RAG)\n`);
    return chunks;
  }
  
  /**
   * Format timestamp for logging (seconds → MM:SS)
   */
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Format text using NLP (compromise) into clean paragraphs
   * Groups specified number of sentences (default: 3) into readable blocks
   */
  private formatWithNLP(text: string, sentencesPerParagraph: number = 3): string {
    if (!text || text.trim().length === 0) return "";
    
    const cleanText = text.replace(/\s+/g, " ").trim();
    const doc = nlp(cleanText);
    const sentences = doc.sentences().out("array") as string[];
    
    if (sentences.length === 0) return cleanText;
    
    const paragraphs: string[] = [];
    
    // Group sentences in chunks of `sentencesPerParagraph` using slice
    for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
      const paragraph = sentences.slice(i, i + sentencesPerParagraph)
        .map(s => s.trim())
        .join(" ");
      paragraphs.push(paragraph);
    }
    
    return paragraphs.join("\n\n");
  }
  
  /**
   * Chunk text using NLP sentence boundaries
   * Optimized for RAG: 50-100 words per chunk (300-500 chars)
   */
  private async chunkWithNLP(
    content: string,
    metadata: Partial<ChunkMetadata>,
    targetWords: number = 75 // Optimal for semantic search
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const doc = nlp(content);
    const sentences = doc.sentences().out("array") as string[];
    
    let currentChunk: string[] = [];
    let currentWordCount = 0;
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      const sentenceWords = trimmedSentence.split(/\s+/).length;
      
      if (currentWordCount + sentenceWords > targetWords && currentChunk.length > 0) {
        const chunkText = currentChunk.join(" ");
        
        console.log(`   📦 [CHUNKING] Chunk ${chunkIndex + 1}: ${chunkText.length} chars, ${currentWordCount} words`);
        console.log(`      Preview: "${chunkText.substring(0, 100)}..."`);
        
        chunks.push({
          content: chunkText,
          metadata: {
            ...metadata,
            chunkIndex,
            totalChunks: undefined,
          } as ChunkMetadata,
        });
        
        currentChunk = [];
        currentWordCount = 0;
        chunkIndex++;
      }
      
      currentChunk.push(trimmedSentence);
      currentWordCount += sentenceWords;
    }
    
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(" ");
      
      console.log(`   📦 [CHUNKING] Chunk ${chunkIndex + 1} (final): ${chunkText.length} chars, ${currentWordCount} words`);
      console.log(`      Preview: "${chunkText.substring(0, 100)}..."`);
      
      chunks.push({
        content: chunkText,
        metadata: {
          ...metadata,
          chunkIndex,
          totalChunks: undefined,
        } as ChunkMetadata,
      });
    }
    
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });
    
    return chunks;
  }

  /**
   * Chunk web content (blogs, articles)
   */
  private async chunkWebContent(
    content: string,
    metadata: Partial<ChunkMetadata>
  ): Promise<DocumentChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
      separators: ["\n\n\n", "\n\n", "\n", ". ", " ", ""],
    });

    const docs = await splitter.createDocuments([content]);

    return docs.map((doc, index) => ({
      content: doc.pageContent,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: docs.length,
      } as ChunkMetadata,
    }));
  }

  /**
   * Chunk uploaded documents (PDFs, DOCX, etc.)
   */
  private async chunkDocumentFile(
    content: string,
    metadata: Partial<ChunkMetadata>
  ): Promise<DocumentChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n\n", "\n\n", "\n", ". ", " ", ""],
    });

    const docs = await splitter.createDocuments([content]);

    return docs.map((doc, index) => ({
      content: doc.pageContent,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: docs.length,
      } as ChunkMetadata,
    }));
  }

  /**
   * Chunk pasted text content
   */
  private async chunkTextContent(
    content: string,
    metadata: Partial<ChunkMetadata>
  ): Promise<DocumentChunk[]> {
    if (content.length < 2000) {
      return [
        {
          content,
          metadata: {
            ...metadata,
            chunkIndex: 0,
            totalChunks: 1,
          } as ChunkMetadata,
        },
      ];
    }

    return this.chunkGeneric(content, metadata, 800, 150);
  }

  /**
   * Generic text chunking
   */
  private async chunkGeneric(
    content: string,
    metadata: Partial<ChunkMetadata>,
    chunkSize: number = 800,
    chunkOverlap: number = 150
  ): Promise<DocumentChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    const docs = await splitter.createDocuments([content]);

    return docs.map((doc, index) => ({
      content: doc.pageContent,
      metadata: {
        ...metadata,
        chunkIndex: index,
        totalChunks: docs.length,
      } as ChunkMetadata,
    }));
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text: string): number {
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / 0.75);
  }

  /**
   * Validate chunk quality
   */
  isValidChunk(chunk: DocumentChunk): boolean {
    const content = chunk.content.trim();
    if (content.length < 50 || content.length > 10000) return false;
    
    const wordCount = content.split(/\s+/).filter(w => w.length > 2).length;
    return wordCount >= 10;
  }
}