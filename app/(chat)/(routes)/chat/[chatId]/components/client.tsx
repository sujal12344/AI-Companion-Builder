"use client";

import ChatHeader from "@/components/ChatHeader";
import { Companion, Message } from "@prisma/client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCompletion } from "ai/react";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { ChatMessages } from "@/components/ChatMessages";
import { ChatMessageProps } from "@/components/ChatMessage";
import { Tone } from "@prisma/client";

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
    companion.messages as ChatMessageProps[]
  );
  const [tone, setTone] = useState<Tone>();

  const { input, isLoading, setInput, handleSubmit, handleInputChange} = useCompletion({
    api: `/api/chat/${companion.id}?tone=${tone}`,
    onFinish(prompt, completion) {
      console.log(`prompt`, prompt, `completion`, completion);

      const systemMessage: ChatMessageProps = {
        role: "system",
        content: completion,
        tone: tone,
      };
      console.log(`systemMessage`, systemMessage);
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
      tone: tone,
    };
    setMessages((current) => [...current, userMessage]);
    handleSubmit(e);
    console.log(`tone`, tone);
    console.log(`input`, input);
    console.log(`userMessage`, userMessage);
  };

  const placeholders = {
    "Stephen Hawking": [
      "Explain the blackhole concept.",
      "What is the purpose of life?",
      "How blackholes are formed?",
      "What is the future of the universe?",
      "Can you explain the concept of time?",
    ],
    "Albert Einstein": [
      "Explain the theory of relativity.",
      "What is the purpose of life?",
      "How time is different for different observers?",
      "Can you explain the concept of space?",
      "What is the future of the universe?",
    ],
    "Elon Musk": [
      "How to build your own business?",
      "why normal people should invest in crypto?",
      "How to become a billionaire?",
      "How to save the time?",
    ],
    "default": [
      "What's your favorite topic to discuss?",
      "Tell me about yourself",
      "What interests you the most?",
      "How can you help me learn?",
      "What makes you unique?"
    ]
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-2">
      <ChatHeader companion={companion} />
      <ChatMessages
        companion={companion}
        isLoading={isLoading}
        messages={messages}
      />
      <PlaceholdersAndVanishInput
        placeholders={placeholders[companion.name as keyof typeof placeholders] || placeholders["default"]}
        onChange={handleInputChange}
        onSubmit={onSubmit}
        disabled={isLoading}
        inputValue={input}
        getTone={(tone: Tone | undefined) => setTone(tone)} // Pass the setTone function to the child
      />
    </div>
  );
};
