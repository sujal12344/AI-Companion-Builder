import { BaseSourceAdapter } from "../base-adapter";
import {
  ValidationResult,
  DiscoveredItem,
  NormalizedDocument,
  SourceAdapterConfig,
} from "../types";
import { SourceType } from "@prisma/client";

/**
 * Text Source Adapter
 * Handles manually pasted text content
 */
export class TextSourceAdapter extends BaseSourceAdapter {
  getSourceType(): SourceType {
    return SourceType.TEXT_PASTE;
  }

  async validate(input: string): Promise<ValidationResult> {
    const trimmed = input.trim();

    if (!trimmed) {
      return {
        isValid: false,
        errorMessage: "Text content is empty",
      };
    }

    // Minimum content length (50 characters)
    if (trimmed.length < 50) {
      return {
        isValid: false,
        errorMessage: "Text content is too short (minimum 50 characters)",
      };
    }

    // Maximum content length (500KB)
    const maxLength = 500 * 1024;
    if (trimmed.length > maxLength) {
      return {
        isValid: false,
        errorMessage: `Text content is too large (maximum ${maxLength / 1024}KB)`,
      };
    }

    return {
      isValid: true,
      metadata: {
        contentLength: trimmed.length,
        wordCount: this.countWords(trimmed),
      },
    };
  }

  async discover(
    sourceId: string,
    input: string,
    config?: SourceAdapterConfig
  ): Promise<DiscoveredItem[]> {
    const trimmed = input.trim();
    const title = config?.title as string || this.generateTitleFromContent(trimmed);

    return [
      {
        externalId: this.hashString(trimmed),
        title: this.sanitizeTitle(title),
        description: this.truncate(trimmed, 200),
        metadata: {
          contentLength: trimmed.length,
          wordCount: this.countWords(trimmed),
          preview: this.truncate(trimmed, 500),
        },
      },
    ];
  }

  async fetch(
    item: DiscoveredItem,
    sourceId: string
  ): Promise<NormalizedDocument> {
    // For text paste, the content is stored in metadata.preview or needs to be passed
    const content = item.metadata?.content as string || item.metadata?.preview as string || item.description || "";

    if (!content.trim()) {
      throw new Error("No text content available");
    }

    return {
      externalId: item.externalId,
      title: item.title,
      content: this.normalizeText(content),
      sourceType: SourceType.TEXT_PASTE,
      metadata: {
        contentLength: content.length,
        wordCount: this.countWords(content),
      },
      contentHash: this.generateContentHash(content),
    };
  }

  getExternalId(item: DiscoveredItem | string): string {
    if (typeof item === "string") {
      return this.hashString(item);
    }
    return item.externalId;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Generate a title from the first few words of content
   */
  private generateTitleFromContent(content: string): string {
    const firstLine = content.split("\n")[0].trim();
    
    if (firstLine.length > 0) {
      // Use first line if it's not too long
      if (firstLine.length <= 100) {
        return firstLine;
      }
      // Truncate first line
      return this.truncate(firstLine, 100);
    }

    // Use first N words
    const words = content.split(/\s+/).slice(0, 10).join(" ");
    return this.truncate(words, 100);
  }
}

/**
 * Parse multiple text entries (e.g., from CSV, JSON array, or separated blocks)
 */
export async function parseMultipleTextEntries(
  input: string,
  format: "auto" | "json" | "csv" | "separated" = "auto"
): Promise<Array<{ title: string; content: string }>> {
  const entries: Array<{ title: string; content: string }> = [];

  try {
    if (format === "json" || (format === "auto" && input.trim().startsWith("["))) {
      // Parse JSON array
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string") {
            entries.push({
              title: item.substring(0, 100),
              content: item,
            });
          } else if (item.title && item.content) {
            entries.push({
              title: item.title,
              content: item.content,
            });
          } else if (item.text) {
            entries.push({
              title: item.text.substring(0, 100),
              content: item.text,
            });
          }
        }
      }
      return entries;
    }

    if (format === "csv" || (format === "auto" && input.includes("\n") && input.includes(","))) {
      // Simple CSV parsing (title,content)
      const lines = input.split("\n").filter((line) => line.trim().length > 0);
      
      // Skip header if it looks like one
      let startIndex = 0;
      if (lines[0].toLowerCase().includes("title") || lines[0].toLowerCase().includes("content")) {
        startIndex = 1;
      }

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts.length >= 2) {
          entries.push({
            title: parts[0].trim().replace(/^["']|["']$/g, ""),
            content: parts.slice(1).join(",").trim().replace(/^["']|["']$/g, ""),
          });
        }
      }
      return entries;
    }

    // Separated format: entries separated by delimiter
    if (format === "separated" || format === "auto") {
      // Try common separators
      const separators = ["---", "===", "***", "\n\n\n"];
      
      for (const separator of separators) {
        if (input.includes(separator)) {
          const blocks = input.split(separator).filter((block) => block.trim().length > 0);
          
          for (const block of blocks) {
            const trimmed = block.trim();
            const firstLine = trimmed.split("\n")[0];
            
            entries.push({
              title: firstLine.substring(0, 100),
              content: trimmed,
            });
          }
          
          if (entries.length > 0) {
            return entries;
          }
        }
      }
    }

    // Default: treat entire input as single entry
    if (entries.length === 0) {
      const adapter = new TextSourceAdapter();
      entries.push({
        title: adapter["generateTitleFromContent"](input),
        content: input,
      });
    }

    return entries;
  } catch (error) {
    console.error("Failed to parse multiple text entries:", error);
    // Fallback: return as single entry
    const adapter = new TextSourceAdapter();
    return [{
      title: adapter["generateTitleFromContent"](input),
      content: input,
    }];
  }
}
