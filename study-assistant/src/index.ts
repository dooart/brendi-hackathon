import { config } from "dotenv";
import OpenAI from "openai";
import readlineSync from "readline-sync";
import { Message, Conversation } from "./types";
import { startNoteDetection, Note } from "./notes";
import { NoteDatabase } from "./database";
import { ReviewMode } from './review';

// Command types and constants
type Command = {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<string>;
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
const handleExit = async (): Promise<string> => {
  displayGoodbye();
  return "Goodbye! Happy studying!";
};

const handleHelp = async (): Promise<string> => {
  const helpMessage = [
    "Available commands:",
    "  help    - Show this help message",
    "  exit    - Exit the application",
    "  quit    - Exit the application",
    "  q       - Exit the application",
    "  bye     - Exit the application",
    "  review  - Start a review session",
    "  stats   - Show review session statistics",
    "  notes   - List all notes",
    "  search  - Search notes by tag",
    "",
    "You can also just type your questions or topics to discuss!"
  ].join('\n');
  
  displayMessage(helpMessage);
  return helpMessage;
};

// Note handling
const handleNoteCreated = (note: Note, db: NoteDatabase): void => {
  // Save note to database
  db.saveNote(note);

  // Display note information
  console.log("\n📝 New note created!");
  console.log(`Title: ${note.title}`);
  console.log(`Tags: ${note.tags.join(", ")}`);
  console.log("\nContent:");
  console.log(note.content);
  console.log("\n---");
};

// Add note-related commands
const handleListNotes = async (db: NoteDatabase): Promise<string> => {
  const notes = db.getAllNotes();
  
  if (notes.length === 0) {
    return "No notes found.";
  }

  const noteList = notes.map(note => 
    `- ${note.title} (${note.tags.join(", ")})`
  ).join("\n");

  return `Found ${notes.length} notes:\n${noteList}`;
};

const handleSearchNotes = async (
  db: NoteDatabase,
  query: string
): Promise<string> => {
  const notes = db.getNotesByTag(query);
  
  if (notes.length === 0) {
    return `No notes found with tag: ${query}`;
  }

  const noteList = notes.map(note => 
    `- ${note.title} (${note.tags.join(", ")})`
  ).join("\n");

  return `Found ${notes.length} notes with tag "${query}":\n${noteList}`;
};

// Command handling functions
const isExitCommand = (input: string): boolean =>
  EXIT_COMMANDS.includes(input.toLowerCase());

const isHelpCommand = (input: string): boolean =>
  input.toLowerCase() === HELP_COMMAND;

const getCommand = (input: string, commands: Command[]): Command | undefined =>
  commands.find(cmd => cmd.name === input.toLowerCase());

// Update the main function
const main = async (): Promise<void> => {
  config();
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  const openai = createOpenAIClient(apiKey);
  const db = new NoteDatabase();
  const reviewMode = new ReviewMode(db);
  let isInReviewMode = false;
  let conversation: Conversation = [];

  // Define commands with access to db
  const commands: Command[] = [
    {
      name: "help",
      description: "Show available commands",
      execute: async () => {
        return commands.map(cmd => `${cmd.name}: ${cmd.description}`).join("\n");
      }
    },
    {
      name: "exit",
      description: "Exit the program",
      execute: async () => {
        process.exit(0);
        return "";
      }
    },
    {
      name: "review",
      description: "Start a review session",
      execute: async () => {
        isInReviewMode = true;
        const response = await reviewMode.startReview();
        const question = await reviewMode.getNextQuestion();
        if (question) {
          return response + "\n\n" + question;
        } else {
          isInReviewMode = false;
          return response;
        }
      }
    },
    {
      name: "stats",
      description: "Show review session statistics",
      execute: async () => {
        return reviewMode.getSessionStats();
      }
    },
    {
      name: 'notes',
      description: 'List all notes',
      execute: async () => {
        return await handleListNotes(db);
      }
    },
    {
      name: 'search',
      description: 'Search notes by tag',
      execute: async (args) => {
        const tag = args[1] || readlineSync.question("Enter tag to search: ");
        return await handleSearchNotes(db, tag);
      }
    }
  ];

  // Start note detection with database integration
  const noteDetector = startNoteDetection(openai, (note) => handleNoteCreated(note, db));

  displayWelcome();

  try {
    while (true) {
      const userInput = getUserInput();

      if (isExitCommand(userInput)) {
        const response = await handleExit();
        displayMessage(response);
        break;
      }

      if (isHelpCommand(userInput)) {
        const response = await handleHelp();
        displayMessage(response);
        continue;
      }

      const command = commands.find(cmd => cmd.name === userInput.toLowerCase());
      if (command) {
        const response = await command.execute(userInput.split(" "));
        displayMessage(response);
        continue;
      }

      if (isInReviewMode) {
        const evaluation = await reviewMode.evaluateAnswer(userInput);
        displayMessage(evaluation.feedback);
        if (evaluation.followUpQuestion) {
          displayMessage("Follow-up question: " + evaluation.followUpQuestion);
        }
        const hasNext = await reviewMode.moveToNextNote();
        if (!hasNext) {
          isInReviewMode = false;
          displayMessage("Review session completed!");
        } else {
          const nextQuestion = await reviewMode.getNextQuestion();
          if (nextQuestion) {
            displayMessage(nextQuestion);
          } else {
            isInReviewMode = false;
            displayMessage("No more questions available. Review session completed!");
          }
        }
        continue;
      }

      // Normal conversation flow
      conversation = [...conversation, createUserMessage(userInput)];
      const aiResponse = await getAIResponse(openai, conversation);
      displayMessage(aiResponse);
      conversation = [...conversation, createAssistantMessage(aiResponse)];
    }
  } finally {
    // Ensure database is closed
    db.close();
  }
};

// Start the application
main().catch(console.error); 