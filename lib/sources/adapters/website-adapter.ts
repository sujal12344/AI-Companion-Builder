import { BaseSourceAdapter } from "../base-adapter";
import {
  ValidationResult,
  DiscoveredItem,
  NormalizedDocument,
  SourceAdapterConfig,
} from "../types";
import { SourceType } from "@prisma/client";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import Sitemapper from "sitemapper";
import RSSParser from "rss-parser";
import * as cheerio from "cheerio";
import axios from "axios";

/**
 * Website Source Adapter
 * Handles websites, blogs, sitemap, and RSS feeds
 */
export class WebsiteSourceAdapter extends BaseSourceAdapter {
  private readonly USER_AGENT =
    "Mozilla/5.0 (compatible; AICompanionBot/1.0; +https://ai-companion.app)";
  private readonly TIMEOUT = 30000; // 30 seconds
  private readonly MAX_REDIRECTS = 5;

  getSourceType(): SourceType {
    return SourceType.WEBSITE;
  }

  async validate(input: string): Promise<ValidationResult> {
    try {
      // Validate URL format
      if (!this.isValidUrl(input)) {
        return {
          isValid: false,
          errorMessage: "Invalid URL format",
        };
      }

      const url = new URL(input);

      // Block dangerous URLs
      if (this.isBlockedUrl(input)) {
        return {
          isValid: false,
          errorMessage: "URL is blocked (localhost, private IP, or unsafe protocol)",
        };
      }

      // Try to fetch the URL with timeout
      try {
        const response = await axios.get(input, {
          timeout: this.TIMEOUT,
          maxRedirects: this.MAX_REDIRECTS,
          headers: {
            "User-Agent": this.USER_AGENT,
          },
          validateStatus: (status) => status < 400,
        });

        const contentType = response.headers["content-type"] || "";
        const canonicalUrl = response.request?.res?.responseUrl || input;

        return {
          isValid: true,
          canonicalUrl,
          metadata: {
            domain: url.hostname,
            contentType,
            statusCode: response.status,
          },
        };
      } catch (error: any) {
        if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
          return {
            isValid: false,
            errorMessage: "Unable to connect to website (connection refused or timeout)",
          };
        }
        if (error.response?.status === 403 || error.response?.status === 401) {
          return {
            isValid: false,
            errorMessage: "Website requires authentication or blocks automated access",
          };
        }
        throw error;
      }
    } catch (error) {
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
    const items: DiscoveredItem[] = [];
    const processedUrls = new Set<string>();
    const domain = this.extractDomain(input);

    // Configuration
    const maxPages = typeof config?.maxPages === "number" ? config.maxPages : 100;
    const maxDepth = typeof config?.maxDepth === "number" ? config.maxDepth : 2;
    const followSitemap = config?.followSitemap !== false;
    const followRss = config?.followRss !== false;

    // 1. Try sitemap discovery
    if (followSitemap) {
      try {
        const sitemapUrls = await this.discoverSitemap(input, maxPages);
        for (const url of sitemapUrls) {
          if (!processedUrls.has(url)) {
            processedUrls.add(url);
            items.push({
              externalId: this.hashString(url),
              title: url,
              url,
              metadata: { source: "sitemap" },
            });
          }
        }
        console.log(`Discovered ${sitemapUrls.length} URLs from sitemap`);
      } catch (error) {
        console.warn("Sitemap discovery failed:", error);
      }
    }

    // 2. Try RSS/Atom feed discovery
    if (followRss) {
      try {
        const rssItems = await this.discoverRSS(input, maxPages);
        for (const item of rssItems) {
          if (!processedUrls.has(item.url!)) {
            processedUrls.add(item.url!);
            items.push(item);
          }
        }
        console.log(`Discovered ${rssItems.length} items from RSS feeds`);
      } catch (error) {
        console.warn("RSS discovery failed:", error);
      }
    }

    // 3. If no items found via sitemap/RSS, crawl the page
    if (items.length === 0) {
      try {
        const crawledUrls = await this.crawlWebsite(
          input,
          domain,
          maxDepth,
          Math.min(maxPages, 50), // Limit crawling to 50 pages max
          processedUrls
        );
        
        for (const url of crawledUrls) {
          if (!processedUrls.has(url)) {
            processedUrls.add(url);
            items.push({
              externalId: this.hashString(url),
              title: url,
              url,
              metadata: { source: "crawl" },
            });
          }
        }
        console.log(`Discovered ${crawledUrls.length} URLs from crawling`);
      } catch (error) {
        console.warn("Crawling failed:", error);
      }
    }

    // 4. If still no items, at least include the original URL
    if (items.length === 0) {
      items.push({
        externalId: this.hashString(input),
        title: input,
        url: input,
        metadata: { source: "manual" },
      });
    }

    return items.slice(0, maxPages);
  }

  async fetch(
    item: DiscoveredItem,
    sourceId: string
  ): Promise<NormalizedDocument> {
    const url = item.url!;

    try {
      const loader = new CheerioWebBaseLoader(url, {
        selector: "body",
        timeout: this.TIMEOUT,
      });

      const docs = await loader.load();

      if (docs.length === 0 || !docs[0].pageContent.trim()) {
        throw new Error("No content found on page");
      }

      const content = docs[0].pageContent;
      const metadata = docs[0].metadata || {};

      // Extract additional metadata
      const enrichedMetadata = await this.extractMetadata(url, content);

      return {
        externalId: item.externalId,
        title: enrichedMetadata.title || item.title || url,
        content: this.normalizeText(this.cleanContent(content)),
        sourceUrl: url,
        sourceType: SourceType.WEBSITE,
        author: enrichedMetadata.author,
        publishedAt: enrichedMetadata.publishedAt,
        metadata: {
          ...metadata,
          ...enrichedMetadata,
          domain: this.extractDomain(url),
        },
        contentHash: this.generateContentHash(content),
      };
    } catch (error) {
      throw new Error(`Failed to fetch website: ${(error as Error).message}`);
    }
  }

  getExternalId(item: DiscoveredItem | string): string {
    if (typeof item === "string") {
      return this.hashString(item);
    }
    return item.externalId;
  }

  /**
   * Discover URLs from sitemap.xml
   */
  private async discoverSitemap(baseUrl: string, maxUrls: number): Promise<string[]> {
    const urls: string[] = [];
    const domain = this.extractDomain(baseUrl);
    const sitemapUrls = [
      `${new URL(baseUrl).origin}/sitemap.xml`,
      `${new URL(baseUrl).origin}/sitemap_index.xml`,
      `${new URL(baseUrl).origin}/sitemap-index.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const sitemapper = new Sitemapper({
          url: sitemapUrl,
          timeout: this.TIMEOUT,
        });

        const { sites } = await sitemapper.fetch();
        
        for (const site of sites) {
          if (urls.length >= maxUrls) break;
          // Only include URLs from same domain
          if (this.extractDomain(site) === domain) {
            urls.push(site);
          }
        }

        if (urls.length > 0) break; // Found a working sitemap
      } catch (error) {
        // Try next sitemap URL
        continue;
      }
    }

    return urls;
  }

  /**
   * Discover items from RSS/Atom feeds
   */
  private async discoverRSS(baseUrl: string, maxItems: number): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = [];
    const parser = new RSSParser({
      timeout: this.TIMEOUT,
    });

    // Common RSS feed URLs
    const feedUrls = [
      `${new URL(baseUrl).origin}/feed`,
      `${new URL(baseUrl).origin}/rss`,
      `${new URL(baseUrl).origin}/feed.xml`,
      `${new URL(baseUrl).origin}/rss.xml`,
      `${new URL(baseUrl).origin}/atom.xml`,
      baseUrl, // The URL itself might be an RSS feed
    ];

    // Try to discover feed URLs from HTML
    try {
      const response = await axios.get(baseUrl, {
        timeout: this.TIMEOUT,
        headers: { "User-Agent": this.USER_AGENT },
      });
      const $ = cheerio.load(response.data);
      
      $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          const feedUrl = new URL(href, baseUrl).href;
          feedUrls.push(feedUrl);
        }
      });
    } catch (error) {
      // Ignore HTML parsing errors
    }

    // Try each feed URL
    for (const feedUrl of feedUrls) {
      try {
        const feed = await parser.parseURL(feedUrl);

        for (const entry of feed.items) {
          if (items.length >= maxItems) break;

          if (entry.link) {
            items.push({
              externalId: this.hashString(entry.link),
              title: this.sanitizeTitle(entry.title || entry.link),
              description: entry.contentSnippet || entry.content,
              url: entry.link,
              publishedAt: entry.pubDate ? new Date(entry.pubDate) : undefined,
              author: entry.creator || feed.title,
              metadata: {
                source: "rss",
                feedTitle: feed.title,
              },
            });
          }
        }

        if (items.length > 0) break; // Found a working feed
      } catch (error) {
        // Try next feed URL
        continue;
      }
    }

    return items;
  }

  /**
   * Crawl website by following links (same domain only)
   */
  private async crawlWebsite(
    startUrl: string,
    domain: string,
    maxDepth: number,
    maxPages: number,
    processedUrls: Set<string>
  ): Promise<string[]> {
    const urls: string[] = [];
    const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0 && urls.length < maxPages) {
      const { url, depth } = queue.shift()!;

      if (visited.has(url) || depth > maxDepth) continue;
      visited.add(url);

      try {
        const response = await axios.get(url, {
          timeout: this.TIMEOUT,
          headers: { "User-Agent": this.USER_AGENT },
        });

        urls.push(url);

        // Extract links if we haven't reached max depth
        if (depth < maxDepth) {
          const $ = cheerio.load(response.data);
          const links: string[] = [];

          $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            if (href) {
              try {
                const absoluteUrl = new URL(href, url).href;
                const linkDomain = this.extractDomain(absoluteUrl);

                // Only follow same-domain links
                if (linkDomain === domain && !visited.has(absoluteUrl)) {
                  links.push(absoluteUrl);
                }
              } catch {
                // Invalid URL, skip
              }
            }
          });

          // Add links to queue
          for (const link of links) {
            if (urls.length + queue.length < maxPages) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }

        // Rate limiting
        await this.delay(200);
      } catch (error) {
        console.warn(`Failed to crawl ${url}:`, error);
        continue;
      }
    }

    return urls;
  }

  /**
   * Extract metadata from page content
   */
  private async extractMetadata(
    url: string,
    content: string
  ): Promise<{ title?: string; author?: string; publishedAt?: Date }> {
    try {
      const response = await axios.get(url, {
        timeout: this.TIMEOUT,
        headers: { "User-Agent": this.USER_AGENT },
      });

      const $ = cheerio.load(response.data);

      // Extract title
      const title =
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("title").text() ||
        $("h1").first().text();

      // Extract author
      const author =
        $('meta[name="author"]').attr("content") ||
        $('meta[property="article:author"]').attr("content") ||
        $('[rel="author"]').text();

      // Extract publish date
      const publishedAtStr =
        $('meta[property="article:published_time"]').attr("content") ||
        $('meta[name="publish_date"]').attr("content") ||
        $('time[datetime]').attr("datetime");

      const publishedAt = publishedAtStr ? new Date(publishedAtStr) : undefined;

      return {
        title: title ? this.sanitizeTitle(title) : undefined,
        author: author || undefined,
        publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : undefined,
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Clean extracted content (remove scripts, styles, nav, etc.)
   */
  private cleanContent(content: string): string {
    // Remove multiple spaces and newlines
    return content
      .replace(/\s+/g, " ")
      .replace(/\n+/g, "\n")
      .trim();
  }
}
