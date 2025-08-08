import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export async function scrapeWebContent(url: string, title: string) {
  try {
    // Validate URL
    new URL(url);

    const loader = new CheerioWebBaseLoader(url, {
      selector: "body",
    });

    const docs = await loader.load();

    if (docs.length === 0) {
      throw new Error("No content found at URL");
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await textSplitter.splitDocuments(docs);

    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        title,
        type: 'LINK',
        source: url,
        chunkIndex: index,
      }
    }));
  } catch (error) {
    console.error("Failed to scrape web content:", error);
    throw error;
  }
}