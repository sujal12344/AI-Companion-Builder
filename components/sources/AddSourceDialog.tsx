"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Youtube, Globe, FileText, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";
import { Textarea } from "@/components/ui/textarea";

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companionId: string;
  onSourceAdded: () => void;
}

export function AddSourceDialog({
  open,
  onOpenChange,
  companionId,
  onSourceAdded,
}: AddSourceDialogProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [maxVideos, setMaxVideos] = useState("50");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log("🚀 [ADD_SOURCE_DIALOG] Submitting YouTube URL:", youtubeUrl);
      
      const response = await axios.post("/api/sources", {
        companionId,
        input: youtubeUrl,
        sourceType: "YOUTUBE_CHANNEL",
        configuration: {
          maxItems: maxVideos === "all" ? 1000 : parseInt(maxVideos, 10),
        },
      });

      console.log("✅ [ADD_SOURCE_DIALOG] Source created:", response.data);

      toast({
        title: "Source added",
        description: `YouTube source "${response.data.title}" is being processed`,
      });

      setYoutubeUrl("");
      onOpenChange(false);
      onSourceAdded();
    } catch (error: any) {
      console.error("❌ [ADD_SOURCE_DIALOG] Error:", error);
      console.error("Response data:", error.response?.data);
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || "An error occurred";
      
      toast({
        title: "Failed to add source",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWebsite = async () => {
    if (!websiteUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a website URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await axios.post("/api/sources", {
        companionId,
        input: websiteUrl,
        sourceType: "WEBSITE",
      });

      toast({
        title: "Source added",
        description: "Website source is being processed",
      });

      setWebsiteUrl("");
      onOpenChange(false);
      onSourceAdded();
    } catch (error: any) {
      toast({
        title: "Failed to add source",
        description: error.response?.data?.error || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddText = async () => {
    if (!textContent.trim()) {
      toast({
        title: "Content required",
        description: "Please enter text content",
        variant: "destructive",
      });
      return;
    }

    if (!textTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for this text",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await axios.post("/api/sources", {
        companionId,
        input: textContent,
        title: textTitle,
        sourceType: "TEXT_PASTE",
      });

      toast({
        title: "Source added",
        description: "Text source is being processed",
      });

      setTextContent("");
      setTextTitle("");
      onOpenChange(false);
      onSourceAdded();
    } catch (error: any) {
      toast({
        title: "Failed to add source",
        description: error.response?.data?.error || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Knowledge Source</DialogTitle>
          <DialogDescription>
            Connect a new source to enhance your companion's knowledge
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="youtube" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="youtube">
              <Youtube className="w-4 h-4 mr-2" />
              YouTube
            </TabsTrigger>
            <TabsTrigger value="website">
              <Globe className="w-4 h-4 mr-2" />
              Website
            </TabsTrigger>
            <TabsTrigger value="text">
              <FileText className="w-4 h-4 mr-2" />
              Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="youtube" className="space-y-4">
            <div className="space-y-2">
              <Label>YouTube URL</Label>
              <Input
                placeholder="https://www.youtube.com/@channelname or video URL"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                Enter a YouTube channel URL, video URL, or playlist URL. The system will
                automatically discover and process available content.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Video Ingestion Volume</Label>
              <select
                value={maxVideos}
                onChange={(e) => setMaxVideos(e.target.value)}
                disabled={isLoading}
                className="w-full bg-secondary/60 border border-border/60 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              >
                <option value="25">25 Latest Videos (Fast ~5 mins)</option>
                <option value="50">50 Latest Videos (Recommended)</option>
                <option value="100">100 Videos (Comprehensive)</option>
                <option value="all">All Channel Videos (Full archive up to 1,000)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                All videos are processed progressively in the background with real-time UI updates.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">What gets processed:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>For channels: All public uploaded videos</li>
                <li>For videos: Single video content</li>
                <li>For playlists: All videos in the playlist</li>
                <li>Transcripts are automatically extracted when available</li>
                <li>Videos without transcripts will use titles and descriptions</li>
              </ul>
            </div>

            <Button onClick={handleAddYouTube} disabled={isLoading} className="w-full">
              {isLoading ? "Adding..." : "Add YouTube Source"}
            </Button>
          </TabsContent>

          <TabsContent value="website" className="space-y-4">
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                Enter a website or blog URL. The system will attempt to discover content
                via sitemap, RSS feeds, or crawling.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">What gets processed:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Sitemap.xml pages (if available)</li>
                <li>RSS/Atom feed articles (if available)</li>
                <li>Same-domain pages (limited crawling)</li>
                <li>Main content extraction with ads/navigation removed</li>
              </ul>
            </div>

            <Button onClick={handleAddWebsite} disabled={isLoading} className="w-full">
              {isLoading ? "Adding..." : "Add Website Source"}
            </Button>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Enter a title for this content"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                placeholder="Paste your text content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                disabled={isLoading}
                rows={10}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                Minimum 50 characters. You can paste articles, transcripts, notes, or any
                text content.
              </p>
            </div>

            <Button onClick={handleAddText} disabled={isLoading} className="w-full">
              {isLoading ? "Adding..." : "Add Text Source"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
