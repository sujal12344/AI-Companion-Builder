import { ChatRequestOptions } from "ai";

import { SendHorizonal } from "lucide-react";
import { ChangeEvent, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ChatFormProps {
  input: string;
  onChange: (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>
  ) => void;
  onSubmit: (
    e: FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions | undefined
  ) => void;
  isLoading: boolean;
}

export const ChatForm = ({
  input,
  onChange,
  onSubmit,
  isLoading,
}: ChatFormProps) => {
  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-primary/10 py-4 flex gap-x-2 items-center"
    >
      <Input
        disabled={isLoading}
        value={input}
        onChange={onChange}
        placeholder="Type a message..."
        className="bg-primary/10 rounded-lg"
      ></Input>
      <Button disabled={isLoading} variant={"ghost"}>
        <SendHorizonal className="w-6 h-6" />
      </Button>
    </form>
  );
};
