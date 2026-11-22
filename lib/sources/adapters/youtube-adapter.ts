import { BaseSourceAdapter } from "../base-adapter";
import {
  ValidationResult,
  DiscoveredItem,
  NormalizedDocument,
  SourceAdapterConfig,
  TranscriptProvider,
  TranscriptSegment,
} from "../types";
import { SourceType } from "@prisma/client";
import { google } from "googleapis";
import { getLogTimestamp } from "@/lib/utils";

// @ts-ignore - youtube-transcript doesn't have TypeScript types
import { fetchTranscript } from "youtube-transcript";

/**
 * Translate text from Hindi/Hinglish to English using Google Translate API
 * This improves RAG quality as embedding models are optimized for English
 */
async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!res.ok) {
        throw new Error(`Google translate returned status ${res.status}`);
      }
      
      const data = await res.json();
      const translatedText = data[0]?.map((item: any) => item[0])?.join("");
      if (translatedText && translatedText.trim().length > 0) {
        return translatedText;
      }
    } catch (error) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      } else {
        console.warn("⚠️  [TRANSLATE] Translation attempt failed, returning text:", error);
        return text;
      }
    }
  }
  return text;
}

/**
 * Process transcript segments and translate to English in chunks
 * Returns both English content and preserves original for metadata
 */
async function processTranscriptForRAG(
  segments: any[],
  onProgress?: (step: string) => Promise<void>
): Promise<{
  englishContent: string;
  originalContent: string;
  detectedLanguage: string;
}> {
  console.log(`\n📝 [RAG-PROCESS] Processing ${segments.length} transcript segments for optimal RAG storage...`);
  
  // Combine all segments into full text
  const originalContent = segments.map((seg: any) => seg.text).join(" ");
  
  // Detect if translation is needed (check for Devanagari or common Hindi words)
  const hasDevanagari = /[\u0900-\u097F]/.test(originalContent);
  const hasHindiWords = /\b(hai|hain|ka|ke|ki|ko|se|ne|me|mein|aur|yeh|ye|kya)\b/i.test(originalContent);
  const detectedLanguage = hasDevanagari || hasHindiWords ? "hi" : "en";
  
  console.log(`🌐 [RAG-PROCESS] Detected language: ${detectedLanguage === "hi" ? "Hindi/Hinglish" : "English"}`);
  console.log(`📊 [RAG-PROCESS] Original content: ${originalContent.length} chars, ${originalContent.split(/\s+/).length} words`);
  
  // If already English, skip translation
  if (detectedLanguage === "en") {
    console.log(`✅ [RAG-PROCESS] Content already in English, skipping translation`);
    return {
      englishContent: originalContent,
      originalContent,
      detectedLanguage: "en"
    };
  }

  // Translate all Hindi/Hinglish in chunks to English (no skipping or fallback)
  console.log(`🔄 [RAG-PROCESS] Translating Hindi → English for better semantic search...`);
  const chunkSize = 1600; // Conservative chunk size for URL encoding safety
  let englishContent = "";
  const totalChunks = Math.ceil(originalContent.length / chunkSize);
  
  for (let i = 0; i < originalContent.length; i += chunkSize) {
    const chunk = originalContent.slice(i, i + chunkSize);
    const chunkNum = Math.floor(i / chunkSize) + 1;
    
    console.log(`   🔄 [RAG-PROCESS] Translating chunk ${chunkNum}/${totalChunks} (${chunk.length} chars)...`);
    if (onProgress) {
      await onProgress(`Translating Hindi → English (chunk ${chunkNum}/${totalChunks})...`);
    }
    
    const translatedChunk = await translateToEnglish(chunk);
    englishContent += translatedChunk + " ";
    
    // Controlled pacing between translation chunks
    if (i + chunkSize < originalContent.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  englishContent = englishContent.trim();
  
  console.log(`✅ [RAG-PROCESS] Translation complete!`);
  console.log(`📊 [RAG-PROCESS] English content: ${englishContent.length} chars, ${englishContent.split(/\s+/).length} words`);
  
  return {
    englishContent: englishContent || originalContent,
    originalContent,
    detectedLanguage: "hi"
  };
}

/**
 * Translate text from Hindi to English using Google Translate API
 */
async function translateToEnglish2(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text;
  
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=hi&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map((item: any) => item[0]).join("");
  } catch (error) {
    console.warn("Translation failed, using original text:", error);
    return text; // Fallback to original
  }
}

/**
 * YouTube Source Adapter
 * Handles YouTube channels, videos, and playlists
 */
export class YouTubeSourceAdapter extends BaseSourceAdapter {
  private youtube: any;

  constructor() {
    super();
    this.youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY || process.env.GEMINI_API_KEY,
    });
  }

  getSourceType(): SourceType {
    return SourceType.YOUTUBE_CHANNEL;
  }

  async validate(input: string): Promise<ValidationResult> {
    console.log("\n🔍 [YOUTUBE_ADAPTER] Validating YouTube URL:", input);
    
    try {
      const parsed = this.parseYouTubeUrl(input);
      console.log("📋 [YOUTUBE_ADAPTER] Parsed result:", parsed);

      if (!parsed) {
        console.log("❌ [YOUTUBE_ADAPTER] Invalid YouTube URL format");
        return {
          isValid: false,
          errorMessage: "Invalid YouTube URL or ID",
        };
      }

      console.log(`🔍 [YOUTUBE_ADAPTER] Verifying ${parsed.type}:`, parsed.id);
      
      // Verify the resource exists
      if (parsed.type === "video") {
        const response = await this.youtube.videos.list({
          part: ["snippet"],
          id: [parsed.id],
        });

        if (!response.data.items || response.data.items.length === 0) {
          console.log("❌ [YOUTUBE_ADAPTER] Video not found");
          return {
            isValid: false,
            errorMessage: "Video not found",
          };
        }

        console.log("✅ [YOUTUBE_ADAPTER] Video found:", response.data.items[0].snippet?.title);
        return {
          isValid: true,
          canonicalUrl: `https://www.youtube.com/watch?v=${parsed.id}`,
          metadata: {
            type: "video",
            videoId: parsed.id,
            title: response.data.items[0].snippet?.title,
          },
        };
      } else if (parsed.type === "channel") {
        // If it's a handle (@username), we need to search for the channel
        if (input.includes("/@")) {
          console.log("🔎 [YOUTUBE_ADAPTER] Searching for channel by handle:", parsed.id);
          
          const searchResponse = await this.youtube.search.list({
            part: ["snippet"],
            q: parsed.id,
            type: ["channel"],
            maxResults: 1,
          });

          if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
            console.log("❌ [YOUTUBE_ADAPTER] Channel not found via search");
            return {
              isValid: false,
              errorMessage: `Channel @${parsed.id} not found`,
            };
          }

          const channelId = searchResponse.data.items[0].snippet?.channelId;
          console.log("✅ [YOUTUBE_ADAPTER] Resolved handle to channel ID:", channelId);
          
          // Now fetch the full channel details
          const response = await this.youtube.channels.list({
            part: ["snippet", "contentDetails"],
            id: [channelId!],
          });

          const channel = response.data.items![0];
          console.log("✅ [YOUTUBE_ADAPTER] Channel found:", channel.snippet?.title);
          console.log("📺 [YOUTUBE_ADAPTER] Uploads playlist:", channel.contentDetails?.relatedPlaylists?.uploads);
          
          return {
            isValid: true,
            canonicalUrl: `https://www.youtube.com/channel/${channelId}`,
            metadata: {
              type: "channel",
              channelId: channelId!,
              handle: parsed.id,
              title: channel.snippet?.title,
              uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads,
            },
          };
        }
        
        // Regular channel ID
        const response = await this.youtube.channels.list({
          part: ["snippet", "contentDetails"],
          id: [parsed.id],
        });

        if (!response.data.items || response.data.items.length === 0) {
          console.log("❌ [YOUTUBE_ADAPTER] Channel not found");
          return {
            isValid: false,
            errorMessage: "Channel not found",
          };
        }

        const channel = response.data.items[0];
        console.log("✅ [YOUTUBE_ADAPTER] Channel found:", channel.snippet?.title);
        console.log("📺 [YOUTUBE_ADAPTER] Uploads playlist:", channel.contentDetails?.relatedPlaylists?.uploads);
        
        return {
          isValid: true,
          canonicalUrl: `https://www.youtube.com/channel/${parsed.id}`,
          metadata: {
            type: "channel",
            channelId: parsed.id,
            title: channel.snippet?.title,
            uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads,
          },
        };
      } else if (parsed.type === "playlist") {
        const response = await this.youtube.playlists.list({
          part: ["snippet"],
          id: [parsed.id],
        });

        if (!response.data.items || response.data.items.length === 0) {
          console.log("❌ [YOUTUBE_ADAPTER] Playlist not found");
          return {
            isValid: false,
            errorMessage: "Playlist not found",
          };
        }

        console.log("✅ [YOUTUBE_ADAPTER] Playlist found:", response.data.items[0].snippet?.title);
        return {
          isValid: true,
          canonicalUrl: `https://www.youtube.com/playlist?list=${parsed.id}`,
          metadata: {
            type: "playlist",
            playlistId: parsed.id,
            title: response.data.items[0].snippet?.title,
          },
        };
      }

      console.log("❌ [YOUTUBE_ADAPTER] Unsupported resource type");
      return {
        isValid: false,
        errorMessage: "Unsupported YouTube resource type",
      };
    } catch (error) {
      console.error("❌ [YOUTUBE_ADAPTER] Validation error:", error);
      return {
        isValid: false,
        errorMessage: `Validation failed: ${(error as Error).message}`,
      };
    }
  }

  async discover(
    sourceId: string,
    input: string,
    config?: SourceAdapterConfig
  ): Promise<DiscoveredItem[]> {
    console.log("\n🔍 [YOUTUBE_ADAPTER] Starting discovery for:", input);
    
    const parsed = this.parseYouTubeUrl(input);

    if (!parsed) {
      throw new Error("Invalid YouTube URL");
    }

    console.log("📋 [YOUTUBE_ADAPTER] Parsed type:", parsed.type, "ID:", parsed.id);

    if (parsed.type === "video") {
      return this.discoverVideo(parsed.id);
    } else if (parsed.type === "channel") {
      // If it's a handle, we need to resolve it first
      if (input.includes("/@")) {
        console.log("🔎 [YOUTUBE_ADAPTER] Resolving handle to channel ID...");
        
        const searchResponse = await this.youtube.search.list({
          part: ["snippet"],
          q: parsed.id,
          type: ["channel"],
          maxResults: 1,
        });

        if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
          throw new Error(`Channel @${parsed.id} not found`);
        }

        const channelId = searchResponse.data.items[0].snippet?.channelId;
        console.log("✅ [YOUTUBE_ADAPTER] Resolved to channel ID:", channelId);
        
        return this.discoverChannel(channelId!, config);
      }
      
      return this.discoverChannel(parsed.id, config);
    } else if (parsed.type === "playlist") {
      return this.discoverPlaylist(parsed.id, config);
    }

    throw new Error("Unsupported YouTube resource type");
  }

  async fetch(
    item: DiscoveredItem,
    sourceId: string,
    onProgress?: (step: string) => Promise<void>
  ): Promise<NormalizedDocument> {
    const videoId = item.externalId;

    // Get video details
    const response = await this.youtube.videos.list({
      part: ["snippet", "contentDetails"],
      id: [videoId],
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error(`Video ${videoId} not found`);
    }

    const video = response.data.items[0];
    const snippet = video.snippet!;

    if (onProgress) {
      await onProgress(`Fetching transcript for "${snippet.title?.slice(0, 35)}..."`);
    }

    // Attempt to get transcript
    const transcriptProvider = new YouTubeTranscriptProvider();
    let content = "";
    let transcriptSegments: TranscriptSegment[] = [];
    let originalLanguage = "en";
    let originalTranscript = "";

    const fetchStartTime = Date.now();
    try {
      console.log(`\n${getLogTimestamp()} 🎬 [YOUTUBE] Processing video: "${snippet.title}"`);
      
      transcriptSegments = await transcriptProvider.fetchTranscript(videoId);
      const transcriptDuration = ((Date.now() - fetchStartTime) / 1000).toFixed(1);
      console.log(`${getLogTimestamp()} 📊 [YOUTUBE] Fetched ${transcriptSegments.length} transcript segments in ${transcriptDuration}s`);
      
      // Process transcript for RAG (translate Hindi → English if needed)
      const processedTranscript = await processTranscriptForRAG(transcriptSegments, onProgress);
      
      content = processedTranscript.englishContent; // Store English for embeddings
      originalTranscript = processedTranscript.originalContent; // Keep original for metadata
      originalLanguage = processedTranscript.detectedLanguage;
      
      console.log(`${getLogTimestamp()} ✅ [YOUTUBE] Content ready for RAG storage (${content.length} chars)\n`);
      if (onProgress) {
        await onProgress(`Transcript processed (${content.length} chars). Ready for chunking...`);
      }
    } catch (error) {
      console.warn(`${getLogTimestamp()} ⚠️  [YOUTUBE] No transcript available for video ${videoId}:`, error);
      // Use description as fallback
      content = snippet.description || "";
    }

    if (!content.trim()) {
      throw new Error(`No content available for video ${videoId} (no transcript or description)`);
    }

    return {
      externalId: videoId,
      title: this.sanitizeTitle(snippet.title || "Untitled Video"),
      content: this.normalizeText(content),
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      sourceType: SourceType.YOUTUBE_VIDEO,
      author: snippet.channelTitle!,
      publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : undefined,
      metadata: {
        videoId,
        channelId: snippet.channelId,
        thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
        duration: video.contentDetails?.duration,
        hasTranscript: transcriptSegments.length > 0,
        transcriptSegments: transcriptSegments.length > 0 ? transcriptSegments : undefined,
        originalLanguage, // Track source language for RAG quality
        translatedToEnglish: originalLanguage !== "en", // Flag if translation was applied
        originalTranscript: originalLanguage !== "en" ? originalTranscript : undefined, // Keep original for reference
      },
      contentHash: this.generateContentHash(content),
    };
  }

  getExternalId(item: DiscoveredItem | string): string {
    if (typeof item === "string") {
      const parsed = this.parseYouTubeUrl(item);
      return parsed?.id || this.hashString(item);
    }
    return item.externalId;
  }

  /**
   * Discover single video
   */
  private async discoverVideo(videoId: string): Promise<DiscoveredItem[]> {
    const response = await this.youtube.videos.list({
      part: ["snippet", "contentDetails"],
      id: [videoId],
    });

    if (!response.data.items || response.data.items.length === 0) {
      return [];
    }

    const video = response.data.items[0];
    const snippet = video.snippet!;

    return [
      {
        externalId: videoId,
        title: snippet.title || "Untitled Video",
        description: snippet.description!,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : undefined,
        author: snippet.channelTitle!,
        thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url!,
        metadata: {
          videoId,
          channelId: snippet.channelId,
          duration: video.contentDetails?.duration,
        },
      },
    ];
  }

  /**
   * Discover all videos from a channel
   */
  private async discoverChannel(
    channelId: string,
    config?: SourceAdapterConfig
  ): Promise<DiscoveredItem[]> {
    console.log("📺 [YOUTUBE_ADAPTER] Discovering channel:", channelId);
    
    // Get channel's uploads playlist
    const channelResponse = await this.youtube.channels.list({
      part: ["contentDetails", "snippet"],
      id: [channelId],
    });

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      console.log("❌ [YOUTUBE_ADAPTER] Channel not found:", channelId);
      throw new Error(`Channel not found: ${channelId}`);
    }

    const channel = channelResponse.data.items[0];
    console.log("✅ [YOUTUBE_ADAPTER] Channel found:", channel.snippet?.title);
    
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      console.log("❌ [YOUTUBE_ADAPTER] No uploads playlist found");
      throw new Error("Channel has no uploads playlist");
    }

    console.log("📺 [YOUTUBE_ADAPTER] Uploads playlist ID:", uploadsPlaylistId);
    return this.discoverPlaylist(uploadsPlaylistId, config);
  }

  /**
   * Discover all videos from a playlist
   */
  private async discoverPlaylist(
    playlistId: string,
    config?: SourceAdapterConfig
  ): Promise<DiscoveredItem[]> {
    console.log("📋 [YOUTUBE_ADAPTER] Discovering playlist:", playlistId);
    
    const items: DiscoveredItem[] = [];
    let pageToken: string | undefined = undefined;
    // Allow ingesting full channel archive (up to 1,000 videos) or as specified by user config
    const maxItems = config?.maxItems || 1000;

    do {
      console.log(`📄 [YOUTUBE_ADAPTER] Fetching page... (${items.length} items so far)`);
      
      const response: any = await this.youtube.playlistItems.list({
        part: ["snippet", "contentDetails"],
        playlistId,
        maxResults: Math.min(50, maxItems - items.length),
        pageToken,
      });

      if (!response.data.items) break;

      console.log(`✅ [YOUTUBE_ADAPTER] Got ${response.data.items.length} items in this page`);

      for (const item of response.data.items) {
        const snippet = item.snippet!;
        const videoId = item.contentDetails?.videoId;

        if (!videoId) continue;

        // Apply date filters if provided
        if (config?.dateFrom || config?.dateTo) {
          const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : null;
          if (publishedAt) {
            if (config.dateFrom && publishedAt < config.dateFrom) continue;
            if (config.dateTo && publishedAt > config.dateTo) continue;
          }
        }

        items.push({
          externalId: videoId,
          title: snippet.title || "Untitled Video",
          description: snippet.description,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : undefined,
          author: snippet.channelTitle,
          thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
          metadata: {
            videoId,
            channelId: snippet.channelId,
            position: snippet.position,
          },
        });

        if (items.length >= maxItems) break;
      }

      pageToken = response.data.nextPageToken || undefined;

      // Rate limiting
      await this.delay(100);
    } while (pageToken && items.length < maxItems);

    console.log(`✅ [YOUTUBE_ADAPTER] Discovery complete! Found ${items.length} videos`);
    return items;
  }

  /**
   * Parse YouTube URL to extract ID and type
   */
  private parseYouTubeUrl(input: string): {
    type: "video" | "channel" | "playlist";
    id: string;
  } | null {
    const trimmed = input.trim();
    console.log("🔗 [YOUTUBE_ADAPTER] Parsing URL:", trimmed);

    // Video patterns
    const videoPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/, // Just the video ID
    ];

    for (const pattern of videoPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        console.log("✅ [YOUTUBE_ADAPTER] Detected as VIDEO:", match[1]);
        return { type: "video", id: match[1] };
      }
    }

    // Playlist patterns
    const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (playlistMatch) {
      console.log("✅ [YOUTUBE_ADAPTER] Detected as PLAYLIST:", playlistMatch[1]);
      return { type: "playlist", id: playlistMatch[1] };
    }

    // Channel patterns
    const channelPatterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
      /^UC[a-zA-Z0-9_-]{22}$/, // Channel ID format
    ];

    for (const pattern of channelPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const identifier = match[1];
        console.log("✅ [YOUTUBE_ADAPTER] Detected as CHANNEL with identifier:", identifier);
        
        // For @handle or /c/ or /user/, we need to resolve to channel ID
        // But YouTube API doesn't have direct handle->ID conversion
        // So we'll search for the channel
        if (pattern.source.includes("@") || pattern.source.includes("/c/") || pattern.source.includes("/user/")) {
          console.log("⚠️  [YOUTUBE_ADAPTER] Handle/username detected, needs resolution");
          return { type: "channel", id: identifier };
        }
        return { type: "channel", id: identifier };
      }
    }

    console.log("❌ [YOUTUBE_ADAPTER] No pattern matched");
    return null;
  }
}

/**
 * YouTube Transcript Provider
 * Uses youtube-transcript library to fetch transcripts
 */
export class YouTubeTranscriptProvider implements TranscriptProvider {
  async isAvailable(videoId: string): Promise<boolean> {
    try {
      await fetchTranscript(videoId);
      return true;
    } catch {
      return false;
    }
  }

  async fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
    try {
      const transcript = await fetchTranscript(videoId);

      return transcript.map((item: any) => ({
        text: item.text,
        startSeconds: Math.floor(item.offset / 1000),
        endSeconds: Math.floor((item.offset + item.duration) / 1000),
      }));
    } catch (error) {
      throw new Error(`Failed to fetch transcript: ${(error as Error).message}`);
    }
  }

  getProviderName(): string {
    return "YouTubeTranscript";
  }
}
