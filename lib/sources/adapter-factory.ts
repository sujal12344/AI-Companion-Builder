import { SourceAdapter } from "./types";
import { SourceType } from "@prisma/client";

/**
 * Factory for creating source adapters
 * Central registry for all adapter implementations
 */
export class SourceAdapterFactory {
  private static adapters: Map<SourceType, () => SourceAdapter> = new Map();

  /**
   * Register an adapter for a source type
   */
  static register(sourceType: SourceType, factory: () => SourceAdapter): void {
    this.adapters.set(sourceType, factory);
  }

  /**
   * Get adapter for a source type
   */
  static getAdapter(sourceType: SourceType): SourceAdapter {
    if (this.adapters.size === 0) {
      try {
        const { registerAllAdapters } = require("./register-adapters");
        registerAllAdapters();
      } catch (e) {
        // Ignore if already registered
      }
    }
    const factory = this.adapters.get(sourceType);
    if (!factory) {
      throw new Error(`No adapter registered for source type: ${sourceType}`);
    }
    return factory();
  }

  /**
   * Check if adapter is available for source type
   */
  static hasAdapter(sourceType: SourceType): boolean {
    return this.adapters.has(sourceType);
  }

  /**
   * Get all registered source types
   */
  static getSupportedTypes(): SourceType[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * Auto-detect source type from URL or input
 */
export function detectSourceType(input: string): SourceType | null {
  const trimmedInput = input.trim().toLowerCase();

  // YouTube detection
  if (
    trimmedInput.includes("youtube.com") ||
    trimmedInput.includes("youtu.be")
  ) {
    if (trimmedInput.includes("/playlist")) {
      return SourceType.YOUTUBE_PLAYLIST;
    } else if (trimmedInput.includes("/watch") || trimmedInput.includes("youtu.be/")) {
      return SourceType.YOUTUBE_VIDEO;
    } else if (
      trimmedInput.includes("/channel/") ||
      trimmedInput.includes("/@") ||
      trimmedInput.includes("/c/") ||
      trimmedInput.includes("/user/")
    ) {
      return SourceType.YOUTUBE_CHANNEL;
    }
    return SourceType.YOUTUBE_CHANNEL; // Default to channel
  }

  // GitHub detection
  if (trimmedInput.includes("github.com")) {
    return SourceType.GITHUB_REPO;
  }

  // RSS/Podcast detection (by extension or content-type check)
  if (trimmedInput.endsWith(".xml") || trimmedInput.endsWith(".rss")) {
    return SourceType.RSS_FEED;
  }

  // General website
  if (trimmedInput.startsWith("http://") || trimmedInput.startsWith("https://")) {
    return SourceType.WEBSITE;
  }

  // If no URL patterns match, assume it's text paste
  return SourceType.TEXT_PASTE;
}

/**
 * Get human-readable name for source type
 */
export function getSourceTypeName(sourceType: SourceType): string {
  const names: Record<SourceType, string> = {
    [SourceType.YOUTUBE_CHANNEL]: "YouTube Channel",
    [SourceType.YOUTUBE_VIDEO]: "YouTube Video",
    [SourceType.YOUTUBE_PLAYLIST]: "YouTube Playlist",
    [SourceType.WEBSITE]: "Website",
    [SourceType.RSS_FEED]: "RSS Feed",
    [SourceType.PODCAST_FEED]: "Podcast Feed",
    [SourceType.FILE_UPLOAD]: "File Upload",
    [SourceType.TEXT_PASTE]: "Text Paste",
    [SourceType.GITHUB_REPO]: "GitHub Repository",
    [SourceType.GITHUB_PROFILE]: "GitHub Profile",
    [SourceType.SOCIAL_EXPORT]: "Social Media Export",
  };
  return names[sourceType] || sourceType;
}

/**
 * Get icon name for source type (lucide-react icon names)
 */
export function getSourceTypeIcon(sourceType: SourceType): string {
  const icons: Record<SourceType, string> = {
    [SourceType.YOUTUBE_CHANNEL]: "Youtube",
    [SourceType.YOUTUBE_VIDEO]: "Video",
    [SourceType.YOUTUBE_PLAYLIST]: "List",
    [SourceType.WEBSITE]: "Globe",
    [SourceType.RSS_FEED]: "Rss",
    [SourceType.PODCAST_FEED]: "Podcast",
    [SourceType.FILE_UPLOAD]: "File",
    [SourceType.TEXT_PASTE]: "FileText",
    [SourceType.GITHUB_REPO]: "Github",
    [SourceType.GITHUB_PROFILE]: "Github",
    [SourceType.SOCIAL_EXPORT]: "Share2",
  };
  return icons[sourceType] || "FileQuestion";
}
