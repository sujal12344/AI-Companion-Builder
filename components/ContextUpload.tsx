"use client";

import { useState } from "react";
import { X, Upload, Link, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ContextItem = {
  id: string;
  type: "PDF" | "LINK" | "TEXT";
  title: string;
  content?: string;
  url?: string;
  file?: File;
};

interface ContextUploadProps {
  contexts: ContextItem[];
  onChange: (contexts: ContextItem[]) => void;
  disabled?: boolean;
}

export const ContextUpload = ({
  contexts,
  onChange,
  disabled = false,
}: ContextUploadProps) => {
  const [newContext, setNewContext] = useState<Partial<ContextItem>>({
    type: "TEXT",
    title: "",
  });

  const addContext = () => {
    if (!newContext.title?.trim()) return;

    const contextItem: ContextItem = {
      id: Date.now().toString(),
      type: newContext.type as "PDF" | "LINK" | "TEXT",
      title: newContext.title,
      content: newContext.content,
      url: newContext.url,
      file: newContext.file,
    };

    onChange([...contexts, contextItem]);
    setNewContext({ type: "TEXT", title: "" });
  };

  const removeContext = (id: string) => {
    onChange(contexts.filter((ctx) => ctx.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setNewContext({ ...newContext, file, title: file.name.replace('.pdf', '') });
    }
  };

  const getContextIcon = (type: string) => {
    switch (type) {
      case "PDF":
        return <Upload className="w-4 h-4" />;
      case "LINK":
        return <Link className="w-4 h-4" />;
      case "TEXT":
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Label className="text-base font-medium">Context Sources (Optional)</Label>
        <p className="text-sm text-muted-foreground">
          Add PDFs, links, or text content to enhance your companion's knowledge
        </p>

        {/* Add new context form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Add Context Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={newContext.type}
                  onValueChange={(value) =>
                    setNewContext({ ...newContext, type: value as any })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text Content</SelectItem>
                    <SelectItem value="LINK">Web Link</SelectItem>
                    <SelectItem value="PDF">PDF Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Title</Label>
                <Input
                  placeholder="Context title"
                  value={newContext.title}
                  onChange={(e) =>
                    setNewContext({ ...newContext, title: e.target.value })
                  }
                  disabled={disabled}
                />
              </div>
            </div>

            {newContext.type === "TEXT" && (
              <div>
                <Label>Content</Label>
                <Textarea
                  placeholder="Enter text content about your companion..."
                  value={newContext.content || ""}
                  onChange={(e) =>
                    setNewContext({ ...newContext, content: e.target.value })
                  }
                  rows={4}
                  disabled={disabled}
                />
              </div>
            )}

            {newContext.type === "LINK" && (
              <div>
                <Label>URL</Label>
                <Input
                  placeholder="https://example.com"
                  value={newContext.url || ""}
                  onChange={(e) =>
                    setNewContext({ ...newContext, url: e.target.value })
                  }
                  disabled={disabled}
                />
              </div>
            )}

            {newContext.type === "PDF" && (
              <div>
                <Label>PDF File</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={disabled}
                />
              </div>
            )}

            <Button
              type="button"
              onClick={addContext}
              disabled={disabled || !newContext.title?.trim()}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Context
            </Button>
          </CardContent>
        </Card>

        {/* Display added contexts */}
        {contexts.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Added Context Sources</Label>
            {contexts.map((context) => (
              <div
                key={context.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getContextIcon(context.type)}
                  <div>
                    <p className="font-medium text-sm">{context.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {context.type === "LINK" && context.url}
                      {context.type === "PDF" && context.file?.name}
                      {context.type === "TEXT" &&
                        `${context.content?.slice(0, 50)}${context.content && context.content.length > 50 ? '...' : ''}`
                      }
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeContext(context.id)}
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};