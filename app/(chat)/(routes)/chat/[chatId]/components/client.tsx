"use client";

import ChatHeader from "@/components/ChatHeader";
import { Companion, Message } from "@prisma/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCompletion } from "ai/react";
import { ChatForm } from "@/components/ChatForm";
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

  const {
    input,
    isLoading,
    setInput,
    handleSubmit,
    handleInputChange,
    complete,
    data,
    completion,
    error,
    setCompletion,
    stop,
  } = useCompletion({
    api: `/api/chat/${companion.id}`,
    onFinish(prompt, completion) {
      const systemMessage: ChatMessageProps = {
        role: "system",
        content: completion,
      };
      setMessages((current) => [...current, systemMessage]);
      setInput("");

      router.refresh();
    },
  });

  console.log(`all useCompletion element:`);
  console.log({
    input,
    isLoading,
    setInput,
    handleSubmit,
    handleInputChange,
    complete,
    data,
    completion,
    error,
    setCompletion,
    stop,
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const userMessage: ChatMessageProps = {
      role: "user",
      content: input,
    };
    setMessages((current) => [...current, userMessage]);
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-2">
      <ChatHeader companion={companion} />
      <ChatMessages
        companion={companion}
        isLoading={isLoading}
        messages={messages}
      />
      <ChatForm
        isLoading={isLoading}
        input={input}
        handleInputChange={handleInputChange}
        onSubmit={onSubmit}
      />
    </div>
  );
};
