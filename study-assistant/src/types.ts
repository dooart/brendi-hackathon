export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};
 
export type Conversation = Message[]; 