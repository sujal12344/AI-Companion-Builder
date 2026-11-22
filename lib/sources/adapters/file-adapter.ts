import { BaseSourceAdapter } from "../base-adapter";
import {
  ValidationResult,
  DiscoveredItem,
  NormalizedDocument,
  SourceAdapterConfig,
} from "../types";
import { SourceType } from "@prisma/client";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import path from "path";
import fs from "fs/promises";

/**
 * File Source Adapter
 * Handles uploaded document files (PDF, DOCX, TXT, CSV, JSON)
 */
export class FileSourceAdapter extends BaseSourceAdapter {
  private fileType: "PDF" | "DOCX" | "TXT" | "CSV" | "JSON";

  constructor(fileType: "PDF" | "DOCX" | "TXT" | "CSV" | "JSON") {
    super();
    this.fileType = fileType;
  }

  getSourceType(): SourceType {
    return SourceType.FILE_UPLOAD;
  }

  async validate(input: string): Promise<ValidationResult> {
    try {
      // Input should be a file path
      const stats = await fs.stat(input);

      if (!stats.isFile()) {
        return {
          isValid: false,
          errorMessage: "Path is not a file",
        };
      }

      // Check file extension
      const ext = path.extname(input).toLowerCase();
      const expectedExt = `.${this.fileType.toLowerCase()}`;

      if (ext !== expectedExt && !this.isValidExtensionForType(ext)) {
        return {
          isValid: false,
          errorMessage: `Invalid file type. Expected ${this.fileType}, got ${ext}`,
        };
      }

      // Check file size (max 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (stats.size > maxSize) {
        return {
          isValid: false,
          errorMessage: `File too large. Maximum size is 50MB, file is ${(stats.size / 1024 / 1024).toFixed(2)}MB`,
        };
      }

      if (stats.size === 0) {
        return {
          isValid: false,
          errorMessage: "File is empty",
        };
      }

      return {
        isValid: true,
        canonicalUrl: input,
        metadata: {
          fileType: this.fileType,
          fileName: path.basename(input),
          filePath: input,
          fileSize: stats.size,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        errorMessage: `File validation failed: ${(error as Error).message}`,
      };
    }
  }

  async discover(
    sourceId: string,
    input: string,
    config?: SourceAdapterConfig
  ): Promise<DiscoveredItem[]> {
    // For file uploads, the "discovery" is just the single file
    const fileName = path.basename(input);
    const stats = await fs.stat(input);

    return [
      {
        externalId: this.hashString(input),
        title: this.sanitizeTitle(fileName.replace(/\.[^/.]+$/, "")),
        description: `${this.fileType} document`,
        url: input,
        metadata: {
          fileType: this.fileType,
          fileName,
          filePath: input,
          fileSize: stats.size,
        },
      },
    ];
  }

  async fetch(
    item: DiscoveredItem,
    sourceId: string
  ): Promise<NormalizedDocument> {
    const filePath = item.url || item.metadata?.filePath as string;

    if (!filePath) {
      throw new Error("File path not provided");
    }

    let content = "";
    let metadata: Record<string, unknown> = {
      fileType: this.fileType,
      fileName: path.basename(filePath),
    };

    try {
      switch (this.fileType) {
        case "PDF":
          content = await this.loadPDF(filePath);
          break;
        case "DOCX":
          content = await this.loadDOCX(filePath);
          break;
        case "TXT":
          content = await this.loadTXT(filePath);
          break;
        case "CSV":
          content = await this.loadCSV(filePath);
          break;
        case "JSON":
          content = await this.loadJSON(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${this.fileType}`);
      }

      if (!content.trim()) {
        throw new Error(`No content extracted from ${this.fileType} file`);
      }

      return {
        externalId: item.externalId,
        title: item.title,
        content: this.normalizeText(content),
        sourceUrl: filePath,
        sourceType: SourceType.FILE_UPLOAD,
        metadata: {
          ...metadata,
          ...item.metadata,
        },
        contentHash: this.generateContentHash(content),
      };
    } catch (error) {
      throw new Error(
        `Failed to load ${this.fileType} file: ${(error as Error).message}`
      );
    }
  }

  getExternalId(item: DiscoveredItem | string): string {
    if (typeof item === "string") {
      return this.hashString(item);
    }
    return item.externalId;
  }

  /**
   * Load PDF content
   */
  private async loadPDF(filePath: string): Promise<string> {
    const loader = new PDFLoader(filePath, {
      splitPages: false,
    });
    const docs = await loader.load();
    return docs.map((doc) => doc.pageContent).join("\n\n");
  }

  /**
   * Load DOCX content
   */
  private async loadDOCX(filePath: string): Promise<string> {
    const loader = new DocxLoader(filePath);
    const docs = await loader.load();
    return docs.map((doc) => doc.pageContent).join("\n\n");
  }

  /**
   * Load TXT content
   */
  private async loadTXT(filePath: string): Promise<string> {
    const loader = new TextLoader(filePath);
    const docs = await loader.load();
    return docs.map((doc) => doc.pageContent).join("\n\n");
  }

  /**
   * Load CSV content
   */
  private async loadCSV(filePath: string): Promise<string> {
    try {
      const loader = new CSVLoader(filePath);
      const docs = await loader.load();
      return docs.map((doc) => doc.pageContent).join("\n");
    } catch (error) {
      // Fallback: read as text
      console.warn("CSV loader failed, reading as text:", error);
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    }
  }

  /**
   * Load JSON content
   */
  private async loadJSON(filePath: string): Promise<string> {
    try {
      const loader = new JSONLoader(filePath);
      const docs = await loader.load();
      return docs.map((doc) => doc.pageContent).join("\n\n");
    } catch (error) {
      // Fallback: read and stringify JSON
      console.warn("JSON loader failed, reading as text:", error);
      const content = await fs.readFile(filePath, "utf-8");
      const json = JSON.parse(content);
      return JSON.stringify(json, null, 2);
    }
  }

  /**
   * Check if file extension is valid for the file type
   */
  private isValidExtensionForType(ext: string): boolean {
    const validExtensions: Record<string, string[]> = {
      PDF: [".pdf"],
      DOCX: [".docx", ".doc"],
      TXT: [".txt", ".text", ".md"],
      CSV: [".csv", ".tsv"],
      JSON: [".json", ".jsonl"],
    };

    return validExtensions[this.fileType]?.includes(ext.toLowerCase()) || false;
  }
}

/**
 * Factory function to create appropriate file adapter
 */
export function createFileAdapter(
  fileType: "PDF" | "DOCX" | "TXT" | "CSV" | "JSON"
): FileSourceAdapter {
  return new FileSourceAdapter(fileType);
}
