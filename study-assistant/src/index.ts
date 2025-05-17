import { config } from "dotenv";
import OpenAI from "openai";
import readlineSync from "readline-sync";
import { Message, Conversation } from "./types";
import { startNoteDetection, Note } from "./notes";

// Command types and constants
type Command = {
  name: string;
  description: string;
  execute: (conversation: Conversation) => Promise<Conversation>;
};

const EXIT_COMMANDS = ['exit', 'quit', 'q', 'bye'];
const HELP_COMMAND = 'help';

// Configuration
const createOpenAIClient = (apiKey: string): OpenAI => 
  new OpenAI({ apiKey });

const systemMessage: Message = {
  role: "system",
  content: [
    "You are a helpful study assistant. Your role is to:",
    "1. Help students understand complex concepts",
    "2. Provide clear and concise explanations",
    "3. Ask clarifying questions when needed",
    "4. Break down complex topics into simpler parts",
    "5. Provide examples to illustrate concepts",
    "6. Maintain a supportive and encouraging tone",
    "",
    "When explaining concepts:",
    "- Start with the basics",
    "- Use analogies when helpful",
    "- Provide real-world examples",
    "- Check for understanding",
    "- Encourage questions",
    "",
    "Remember to be patient and adapt your explanations to the student's level of understanding."
  ].join('\n')
};

// Pure functions
const createUserMessage = (content: string): Message => ({
  role: "user",
  content
});

const createAssistantMessage = (content: string): Message => ({
  role: "assistant",
  content
});

const getLastMessages = (conversation: Conversation, count: number): Conversation =>
  conversation.slice(-count);

const shouldExit = (input: string): boolean =>
  input.toLowerCase() === "exit";

const formatMessages = (conversation: Conversation): Message[] => [
  systemMessage,
  ...getLastMessages(conversation, 6)
];

// IO functions
const getUserInput = (): string =>
  readlineSync.question("\nYou: ");

const displayMessage = (message: string): void =>
  console.log("\nAssistant:", message);

const displayError = (error: unknown): void => {
  console.error("\nError:", error);
  console.log("\nI apologize, but I encountered an error. Please try again.");
};

const displayWelcome = (): void => {
  console.log("\nWelcome to your Study Assistant!");
  console.log("Type 'help' to see available commands.");
  console.log("Type your questions or topics to discuss!\n");
};

const displayGoodbye = (): void =>
  console.log("\nGoodbye! Happy studying!");

// OpenAI interaction
const getAIResponse = async (
  openai: OpenAI,
  conversation: Conversation
): Promise<string> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: formatMessages(conversation),
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || 
      "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    displayError(error);
    return "I apologize, but I encountered an error. Please try again.";
  }
};

// Command handlers
const handleExit = async (conversation: Conversation): Promise<Conversation> => {
  displayGoodbye();
  return [
    ...conversation,
    createAssistantMessage("Goodbye! Happy studying!")
  ];
};

const handleHelp = async (conversation: Conversation): Promise<Conversation> => {
  const helpMessage = [
    "Available commands:",
    "  help    - Show this help message",
    "  exit    - Exit the application",
    "  quit    - Exit the application",
    "  q       - Exit the application",
    "  bye     - Exit the application",
    "",
    "You can also just type your questions or topics to discuss!"
  ].join('\n');
  
  displayMessage(helpMessage);
  return [
    ...conversation,
    createAssistantMessage(helpMessage)
  ];
};

const commands: Command[] = [
  {
    name: 'help',
    description: 'Show available commands',
    execute: handleHelp
  }
];

// Command handling functions
const isExitCommand = (input: string): boolean =>
  EXIT_COMMANDS.includes(input.toLowerCase());

const isHelpCommand = (input: string): boolean =>
  input.toLowerCase() === HELP_COMMAND;

const getCommand = (input: string): Command | undefined =>
  commands.find(cmd => cmd.name === input.toLowerCase());

// Update the handleConversation function
const handleConversation = async (
  openai: OpenAI,
  conversation: Conversation
): Promise<Conversation> => {
  const userInput = getUserInput();

  if (isExitCommand(userInput)) {
    return handleExit(conversation);
  }

  if (isHelpCommand(userInput)) {
    return handleHelp(conversation);
  }

  const command = getCommand(userInput);
  if (command) {
    return command.execute(conversation);
  }

  const updatedConversation = [
    ...conversation,
    createUserMessage(userInput)
  ];

  const aiResponse = await getAIResponse(openai, updatedConversation);
  displayMessage(aiResponse);

  return [
    ...updatedConversation,
    createAssistantMessage(aiResponse)
  ];
};

// Note handling
const handleNoteCreated = (note: Note): void => {
  console.log("\n📝 New note created!");
  console.log(`Title: ${note.title}`);
  console.log(`Tags: ${note.tags.join(", ")}`);
  console.log("\nContent:");
  console.log(note.content);
  console.log("\n---");
};

// Update the main function
const main = async (): Promise<void> => {
  config();
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  const openai = createOpenAIClient(apiKey);
  let conversation: Conversation = [];
  const conversationId = `conv_${Date.now()}`;

  // Start note detection
  const noteDetector = startNoteDetection(openai, handleNoteCreated);

  displayWelcome();

  while (true) {
    conversation = await handleConversation(openai, conversation);
    
    // Process conversation for notes
    await noteDetector.process(conversation, conversationId);

    if (conversation.length > 0 && 
        conversation[conversation.length - 1].content === "Goodbye! Happy studying!") {
      noteDetector.stop();
      break;
    }
  }
};

// Start the application
main().catch(console.error); 