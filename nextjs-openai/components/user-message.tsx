import Message from "./message";

export default function UserMessage({ children }: { children: string }) {
  return (
    <Message name="You" theirs={false}>
      {children}
    </Message>
  );
}
