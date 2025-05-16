"use client";

import AssistantMessage from "@/components/assistant-message";
import SendMessageForm from "@/components/send-message-form";
import UserMessage from "@/components/user-message";
import { useChat } from '@ai-sdk/react';
import { Fragment } from "react";

export default function Page() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat();

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
        <SendMessageForm 
          isThinking={true || status === 'streaming' || status === 'submitted'} 
          message={input}
          setMessage={handleInputChange}
          onSendMessage={async () => {
            handleSubmit();
            return Promise.resolve();
          }} 
        />
      </div>
    </div>
  );
}
