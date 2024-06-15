"use client";

import AssistantMessage from "@/components/assistant-message";
import SendMessageForm from "@/components/send-message-form";
import UserMessage from "@/components/user-message";
import { Fragment, useState } from "react";

export type ChatMessage =
  | {
      role: "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string | AsyncIterable<string>;
    };

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const onNewMessage = async (stream: AsyncIterable<string>) => {
    setIsThinking(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: stream,
      },
    ]);
  };

  async function handleSendMessage(message: string) {
    if (!message.trim()) return;

    setIsThinking(true);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: message,
      },
    ]);

    const allMessages = [...messages, { role: "user", content: message }];

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: allMessages }),
    });

    if (!response.ok) {
      const { error } = await response.json();
      console.error(error);
      return;
    }

    const { answer } = await response.json();
    onNewMessage(answer);

    window.scrollTo(0, document.body.scrollHeight);
  }

  return (
    <div className="py-6">
      <div className="flex flex-col gap-6 pb-64">
        {messages.map((message, i) => (
          <Fragment key={i}>
            {message.role === "user" ? (
              <UserMessage>{message.content}</UserMessage>
            ) : (
              <AssistantMessage content={message.content} />
            )}
          </Fragment>
        ))}
      </div>
      <div className="container max-w-screen-md fixed inset-x-0 bottom-0 w-full">
        <SendMessageForm isThinking={isThinking} onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}
