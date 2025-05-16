import { cn } from "@/lib/utils";
import { ChangeEvent } from "react";
import ReactTextareaAutosize from "react-textarea-autosize";
import { Button } from "./button";

export default function SendMessageForm({
  isThinking,
  message,
  setMessage,
  onSendMessage,
}: {
  isThinking: boolean;
  message: string;
  setMessage: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSendMessage: () => Promise<void>;
}) {
  const handleSubmit = async () => {
    const value = message.trim();
    if (!value) return;

    await onSendMessage();
  };

  return (
    <div>
      <form
        className="flex gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <ReactTextareaAutosize
          autoFocus
          maxRows={8}
          rows={1}
          value={message}
          onChange={setMessage}
          placeholder="Type here!"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className={cn(
            "drop-shadow-lg w-full text-lg bg-white rounded-2xl border-2 border-primary p-4 mb-4",
            "resize-none focus-visible:outline-none"
          )}
        />
        <Button disabled={isThinking || !message.trim()} type="submit" className="drop-shadow-lg">
          Send
        </Button>
      </form>
    </div>
  );
}
