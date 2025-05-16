import BlinkingCursor from "./blinking-cursor";
import { Markdown } from "./markdown";
import Message from "./message";

export default function AssistantMessage({ content }: { content: string }) {
  return (
    <Message name="Assistant" theirs>
      {content ? <Markdown>{content}</Markdown> : <BlinkingCursor />}
    </Message>
  );
}
