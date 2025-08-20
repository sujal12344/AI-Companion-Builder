"use client";

import { ElementRef, useEffect, useRef, useState } from "react";
import { Companion } from "@prisma/client";
import { ChatMessage, ChatMessageProps } from "@/components/ChatMessage";
import { v4 } from 'uuid'
interface ChatMessagesProps {
  messages: ChatMessageProps[];
  isLoading: boolean;
  companion: Companion;
}

export const ChatMessages = ({
  messages,
  isLoading,
  companion,
}: ChatMessagesProps) => {
  const scrollRef = useRef<ElementRef<"div">>(null);

  const [isFakeLoading, setIsFakeLoading] = useState(
    messages.length === 0 ? true : false
  );

  useEffect(() => {
    const timeOut = setTimeout(() => {
      setIsFakeLoading(false);
    }, 500);

    return () => {
      clearTimeout(timeOut);
    };
  }, []);

  useEffect(() => {
    scrollRef?.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto pr-4">
      <ChatMessage
        isLoading={isFakeLoading}
        src={companion.img}
        role="system"
        content={`Hello, I am ${companion.name}, ${companion.description}`}
      />
      {messages.map((message) => (
        <ChatMessage
          key={v4()}
          role={message.role}
          content={message.content}
          src={companion.img}
        />
      ))}
      {isLoading && <ChatMessage role="system" src={companion.img} isLoading />}
      <div ref={scrollRef} />
    </div>
  );
};
