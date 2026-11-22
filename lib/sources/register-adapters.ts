import { SourceAdapterFactory } from "./adapter-factory";
import { YouTubeSourceAdapter } from "./adapters/youtube-adapter";
import { FileSourceAdapter, createFileAdapter } from "./adapters/file-adapter";
import { TextSourceAdapter } from "./adapters/text-adapter";
import { WebsiteSourceAdapter } from "./adapters/website-adapter";
import { SourceType } from "@prisma/client";

let isRegistered = false;

/**
 * Register all source adapters with the factory
 * This should be called once at application startup
 */
export function registerAllAdapters() {
  if (isRegistered) return;
  isRegistered = true;

  // YouTube adapters
  SourceAdapterFactory.register(
    SourceType.YOUTUBE_CHANNEL,
    () => new YouTubeSourceAdapter()
  );
  SourceAdapterFactory.register(
    SourceType.YOUTUBE_VIDEO,
    () => new YouTubeSourceAdapter()
  );
  SourceAdapterFactory.register(
    SourceType.YOUTUBE_PLAYLIST,
    () => new YouTubeSourceAdapter()
  );

  // Website adapters
  SourceAdapterFactory.register(
    SourceType.WEBSITE,
    () => new WebsiteSourceAdapter()
  );
  SourceAdapterFactory.register(
    SourceType.RSS_FEED,
    () => new WebsiteSourceAdapter()
  );

  // Text adapter
  SourceAdapterFactory.register(
    SourceType.TEXT_PASTE,
    () => new TextSourceAdapter()
  );

  // File adapters (these are registered but won't work without file path)
  SourceAdapterFactory.register(
    SourceType.FILE_UPLOAD,
    () => createFileAdapter("PDF")
  );

  console.log("✅ Source adapters registered");
}

// Auto-register when this module is imported
registerAllAdapters();
