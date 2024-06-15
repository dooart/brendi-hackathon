import { cn } from "@/lib/utils";
import { useState } from "react";
import ReactTextareaAutosize from "react-textarea-autosize";
import AnimatedEllipsis from "./animated-ellipsis";
import { Button } from "./button";

export default function SendMessageForm({
  isThinking,
  onSendMessage,
}: {
  isThinking: boolean;
  onSendMessage: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    const value = message.trim();
    if (!value) return;

    setMessage("");
    await onSendMessage(value);
  };

  return (
    <div>
      {isThinking && (
        <span className="w-52 inline-block rounded-full text-sm text-muted-foreground pl-4 p-2 mb-1 bg-background">
          Thinking...
          <AnimatedEllipsis />
        </span>
      )}

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
          onChange={(e) => setMessage(e.target.value)}
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
