"use client";

import ChatHeader from "@/components/ChatHeader";
import { Companion, Message } from "@prisma/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCompletion } from "ai/react";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { ChatMessages } from "@/components/ChatMessages";
import { ChatMessageProps } from "@/components/ChatMessage";

interface ChatClientProps {
  companion: Companion & {
    messages: Message[];
    _count: {
      messages: number;
    };
  };
}

export const ChatClient = ({ companion }: ChatClientProps) => {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageProps[]>(
    companion.messages
  );

  const { input, isLoading, setInput, handleSubmit, handleInputChange} = useCompletion({
    api: `/api/chat/${companion.id}`,
    onFinish(prompt, completion) {
      console.log(`prompt`, prompt, `completion`, completion);

      const systemMessage: ChatMessageProps = {
        role: "system",
        content: completion,
      };
      setMessages((current) => [...current, systemMessage]);
      setInput("");

      router.refresh();
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userMessage: ChatMessageProps = {
      role: "user",
      content: input,
    };
    setMessages((current) => [...current, userMessage]);
    handleSubmit(e);
  };

  const placeholders = [
    "What's the first rule of Fight Club?",
    "Who is Tyler Durden?",
    "Where is Andrew Laeddis Hiding?",
    "Write a Javascript method to reverse a string",
    "How to assemble your own PC?",
  ];

  return (
    <div className="flex flex-col h-full p-4 space-y-2">
      <ChatHeader companion={companion} />
      <ChatMessages
        companion={companion}
        isLoading={isLoading}
        messages={messages}
      />
      <PlaceholdersAndVanishInput
        placeholders={placeholders}
        onChange={handleInputChange}
        onSubmit={onSubmit}
        disabled={isLoading}
        inputValue={input}
      />
    </div>
  );
};
