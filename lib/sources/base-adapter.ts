import { SourceAdapter, ValidationResult, DiscoveredItem, NormalizedDocument, SourceAdapterConfig } from "./types";
import { SourceType } from "@prisma/client";
import crypto from "crypto";

/**
 * Abstract base class for source adapters
 * Provides common functionality and enforces interface
 */
export abstract class BaseSourceAdapter implements SourceAdapter {
  abstract validate(input: string): Promise<ValidationResult>;
  abstract discover(sourceId: string, input: string, config?: SourceAdapterConfig): Promise<DiscoveredItem[]>;
  abstract fetch(item: DiscoveredItem, sourceId: string): Promise<NormalizedDocument>;
  abstract getSourceType(): SourceType;

  /**
   * Generate stable external ID from string
   */
  getExternalId(item: DiscoveredItem | string): string {
    if (typeof item === "string") {
      return this.hashString(item);
    }
    return item.externalId;
  }

  /**
   * Generate content hash for deduplication
   */
  protected generateContentHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Hash a string to create stable ID
   */
  protected hashString(input: string): string {
    return crypto.createHash("sha256").update(input).digest("hex").substring(0, 32);
  }

  /**
   * Validate URL format
   */
  protected isValidUrl(input: string): boolean {
    try {
      const url = new URL(input);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Sanitize title for safe usage
   */
  protected sanitizeTitle(title: string): string {
    return title.trim().replace(/[\r\n\t]+/g, " ").substring(0, 500);
  }

  /**
   * Extract domain from URL
   */
  protected extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }

  /**
   * Check if URL is blocked (private IP, localhost, etc.)
   */
  protected isBlockedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Block localhost
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
        return true;
      }

      // Block private IPs (basic check)
      if (
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.16.") ||
        hostname.startsWith("172.17.") ||
        hostname.startsWith("172.18.") ||
        hostname.startsWith("172.19.") ||
        hostname.startsWith("172.2") ||
        hostname.startsWith("172.30.") ||
        hostname.startsWith("172.31.")
      ) {
        return true;
      }

      // Block file:// and other non-http protocols
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return true;
      }

      return false;
    } catch {
      return true; // Block invalid URLs
    }
  }

  /**
   * Delay execution (for rate limiting)
   */
  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry logic for API calls
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await this.delay(delayMs * (i + 1)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Clean and normalize text content
   */
  protected normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, "  ")
      .replace(/\u00A0/g, " ") // Non-breaking space
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width characters
      .trim();
  }

  /**
   * Truncate text to max length
   */
  protected truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }
}
