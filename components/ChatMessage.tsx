"use client";

import { BeatLoader } from "react-spinners";
import { cn } from "@/lib/utils";

import { Copy } from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/use-toast";

import { BotAvatar } from "@/components/BotAvatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";

export interface ChatMessageProps {
  role: "system" | "user";
  content?: string;
  isLoading?: boolean;
  src?: string;
  id?: string;
}

export const ChatMessage = ({
  role,
  content,
  isLoading,
  src,
}: ChatMessageProps) => {
  const { toast } = useToast();
  const { theme } = useTheme();

  const onCopy = () => {
    if (!content) {
      return;
    }
    navigator.clipboard.writeText(content);
    toast({
      description: "Message copied to clipboard",
    });
  };
  return (
    <div
      className={cn(
        "group flex items-start gap-x-3 py-4 w-full",
        role === "user" && "justify-end"
      )}
    >
      {role !== "user" && src && <BotAvatar src={src!} alt="bot avatar" />}
      <div className="bg-primary/20 px-4 py-2 rounded-md max-w-sm text-sm">
        {isLoading ? (
          <BeatLoader
            color={theme === "light" ? "dark" : "white"}
            loading={isLoading}
            size={5}
          />
        ) : (
          content
        )}
      </div>
      {role === "user" && <UserAvatar alt="user avatar" />}
      {role !== "user" && !isLoading && (
        <Button
          className="opacity-0 group-hover:opacity-100 transition"
          size={"icon"}
          variant={"ghost"}
          onClick={onCopy}
          title="Copy"
        >
          <Copy className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
