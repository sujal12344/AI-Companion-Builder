"use client";

import { useState, useCallback } from "react";
import { X, Upload, Link, FileText, Plus, File, FileSpreadsheet, FileJson } from "lucide-react";
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
import { ContextType } from "@prisma/client";

export type ContextItem = {
  id: string;
  type: ContextType;
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

const SUPPORTED_FILE_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/json': 'JSON',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
};

const FILE_EXTENSIONS = {
  '.pdf': 'PDF',
  '.docx': 'DOCX',
  '.txt': 'TXT',
  '.csv': 'CSV',
  '.json': 'JSON',
};

export const ContextUpload = ({
  contexts,
  onChange,
  disabled = false,
}: ContextUploadProps) => {
  const [newContext, setNewContext] = useState<ContextItem>({
    id: Date.now().toString(),
    type: "TEXT",
    title: "",
    content: "",
  });
  const [isDragOver, setIsDragOver] = useState(false);

  const getFileType = (file: File): string | null => {
    // Check MIME type first
    if (SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES]) {
      console.log(SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES], "jyh")
      return SUPPORTED_FILE_TYPES[file.type as keyof typeof SUPPORTED_FILE_TYPES];
    }
    
    // Check file extension
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (FILE_EXTENSIONS[extension as keyof typeof FILE_EXTENSIONS]) {
      console.log(FILE_EXTENSIONS[extension as keyof typeof FILE_EXTENSIONS], "ythgvhb")
      return FILE_EXTENSIONS[extension as keyof typeof FILE_EXTENSIONS];
    }
    
    return null;
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const fileType = getFileType(file);
      return fileType !== null;
    });

    if (validFiles.length > 0) {
      const file = validFiles[0];
      const fileType = getFileType(file) as ContextType;
      if (fileType) {
        setNewContext({
          type: fileType,
          title: file.name.replace(/\.[^/.]+$/, ""),
          file,
          id: Date.now().toString(),
        });
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const addContext = () => {
    if (!newContext.title?.trim()) return;

    const contextItem: ContextItem = {
      id: Date.now().toString(),
      type: newContext.type,
      title: newContext.title,
      content: newContext.content,
      url: newContext.url,
      file: newContext.file,
    };

    onChange([...contexts, contextItem]);

    setNewContext({
      id: Date.now().toString(),
      type: "TEXT",
      title: "",
      content: "",
    });
  };

  const removeContext = (id: string) => {
    onChange(contexts.filter((ctx) => ctx.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileType = getFileType(file);
      if (fileType) {
        setNewContext({
          type: fileType as ContextType,
          title: file.name.replace(/\.[^/.]+$/, ""),
          file,
          id: Date.now().toString(),
        });
      }
    }
  };

  const getContextIcon = (type: string) => {
    switch (type) {
      case "PDF":
        return <File className="w-4 h-4" />;
      case "DOCX":
        return <FileText className="w-4 h-4" />;
      case "TXT":
        return <FileText className="w-4 h-4" />;
      case "CSV":
        return <FileSpreadsheet className="w-4 h-4" />;
      case "LINK":
        return <Link className="w-4 h-4" />;
      case "TEXT":
        return <FileText className="w-4 h-4" />;
      case "JSON":
        return <FileJson className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Label className="text-base font-medium">Context Sources (Optional)</Label>
        <p className="text-sm text-muted-foreground">
          Add documents (PDF, DOCX, TXT, JSON, CSV), links, or text content to enhance your companion's knowledge
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
                    setNewContext({ ...newContext, type: value as ContextType })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text Content (text)</SelectItem>
                    <SelectItem value="LINK">Web Link (https)</SelectItem>
                    <SelectItem value="PDF">PDF Document (.pdf)</SelectItem>
                    <SelectItem value="DOCX">Word Document (.docx)</SelectItem>
                    <SelectItem value="TXT">Text File (.txt)</SelectItem>
                    <SelectItem value="CSV">CSV File (.csv)</SelectItem>
                    <SelectItem value="JSON">JSON File (.json)</SelectItem>
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

            {(newContext.type === "PDF" || newContext.type === "DOCX" || newContext.type === "TXT"|| newContext.type === "CSV" || newContext.type === "JSON") && (
              <div>
                <Label>Document File</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25"
                  }`}
                  onDrop={handleFileDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop your {newContext.type} file here, or click to browse
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={disabled}
                  >
                    Choose File
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept={
                      newContext.type === 'PDF' ? '.pdf,application/pdf' :
                      newContext.type === 'DOCX' ? '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                      newContext.type === 'TXT' ? '.txt,text/plain' :
                      newContext.type === 'CSV' ? '.csv,text/csv' :
                      newContext.type === 'JSON' ? '.json,application/json' :
                      '.pdf,.docx,.txt,.csv,.json'
                    }
                    aria-label="Upload context file"
                    title="Upload context file"
                  />
                </div>
                {newContext.file && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <p className="text-sm font-medium">{newContext.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(newContext.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
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
                      {(context.type === "PDF" || context.type === "DOCX" || context.type === "TXT" || context.type === "CSV" || context.type === "JSON") && context.file?.name}
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