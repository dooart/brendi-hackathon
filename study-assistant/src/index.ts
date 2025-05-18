import { config } from "dotenv";
import OpenAI from "openai";
import readlineSync from "readline-sync";
import { Message, Conversation } from "./types";
import { startNoteDetection, Note } from "./notes";
import { NoteDatabase } from "./database";
import { ReviewMode } from './review';
import { DocumentManager } from "./documents";

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
    "You have access to the following study materials:",
    "{DOCUMENTS}",
    "",
    "When answering questions:",
    "- First search through the available documents for relevant information",
    "- If you find relevant information, use it to provide accurate answers",
    "- If you don't find relevant information, explain that you don't have that specific information in the available materials",
    "- Always cite the source document when using information from it",
    "",
    "Remember to be patient and adapt your explanations to the student's level of understanding.",
    "",
    "IMPORTANT: When outputting mathematical expressions, always use $...$ for inline math and $$...$$ for block math, following standard Markdown+LaTeX conventions. Do NOT use [ ... ], ( ... ), or \\( ... \\) for math. For example: Inline: $x = 2y + 1$. Block: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$. Always ensure all math is properly delimited for Markdown rendering.",
    "Do not add a backslash or any character after the closing $$ of a block math environment. Always continue with text on a new line."
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

const formatMessages = (conversation: Conversation, docManager: DocumentManager): Message[] => {
  // Get list of loaded documents
  const documents = docManager.getLoadedDocuments();
  const documentList = documents.length > 0 
    ? documents.map(doc => `- ${doc}`).join('\n')
    : "No documents currently loaded.";

  // Replace {DOCUMENTS} placeholder in system message
  const updatedSystemMessage = {
    ...systemMessage,
    content: systemMessage.content.replace('{DOCUMENTS}', documentList)
  };

  return [
    updatedSystemMessage,
    ...getLastMessages(conversation, 6)
  ];
};

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
  conversation: Conversation,
  docManager: DocumentManager
): Promise<string> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: formatMessages(conversation, docManager),
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
    "Document commands:",
    "  load <file>  - Load a PDF document into the knowledge base",
    "  docs         - List all loaded documents",
    "  remove <doc> - Remove a document from the knowledge base",
    "  search <q>   - Search through loaded documents",
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

// Add document-related commands
const handleLoadDocument = async (
  docManager: DocumentManager,
  filePath: string
): Promise<string> => {
  try {
    await docManager.loadPDF(filePath);
    return `Successfully loaded document: ${filePath}`;
  } catch (error) {
    return `Error loading document: ${error}`;
  }
};

const handleListDocuments = async (
  docManager: DocumentManager
): Promise<string> => {
  const documents = docManager.getLoadedDocuments();
  if (documents.length === 0) {
    return "No documents loaded.";
  }
  return `Loaded documents:\n${documents.map(doc => `- ${doc}`).join("\n")}`;
};

const handleRemoveDocument = async (
  docManager: DocumentManager,
  fileName: string
): Promise<string> => {
  try {
    await docManager.removeDocument(fileName);
    return `Successfully removed document: ${fileName}`;
  } catch (error) {
    return `Error removing document: ${error}`;
  }
};

const handleSearchDocuments = async (
  docManager: DocumentManager,
  query: string
): Promise<string> => {
  try {
    const results = await docManager.searchDocuments(query);
    if (results.length === 0) {
      return "No relevant information found in the documents.";
    }
    
    const formattedResults = results.map((doc, i) => {
      const source = doc.metadata.source as string;
      const page = doc.metadata.page as number;
      return `[${i + 1}] From ${source} (Page ${page}):\n${doc.pageContent}\n`;
    }).join("\n");
    
    return `Found ${results.length} relevant sections:\n\n${formattedResults}`;
  } catch (error) {
    return `Error searching documents: ${error}`;
  }
};

// Command handling functions
const isExitCommand = (input: string): boolean =>
  EXIT_COMMANDS.includes(input.toLowerCase());

const isHelpCommand = (input: string): boolean =>
  input.toLowerCase() === HELP_COMMAND;

const parseCommand = (input: string): { command: string; args: string[] } => {
  // First, handle the load command specially to preserve file paths
  if (input.toLowerCase().startsWith('load ')) {
    const command = 'load';
    // Get everything after 'load ' as a single argument
    let filePath = input.slice(5).trim();
    // Remove surrounding quotes if they exist
    if ((filePath.startsWith("'") && filePath.endsWith("'")) || 
        (filePath.startsWith('"') && filePath.endsWith('"'))) {
      filePath = filePath.slice(1, -1);
    }
    return { command, args: [filePath] };
  }

  // For other commands, split by spaces
  const parts = input.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  return { command, args };
};

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
  const docManager = new DocumentManager(apiKey, db);
  let isInReviewMode = false;
  let conversation: Conversation = [];

  // Define commands with access to db and docManager
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
    },
    {
      name: "load",
      description: "Load a PDF document into the knowledge base",
      execute: async (args) => {
        if (args.length === 0) {
          return "Please provide a file path to load.";
        }
        return await handleLoadDocument(docManager, args[0]);
      }
    },
    {
      name: "docs",
      description: "List all loaded documents",
      execute: async () => {
        return await handleListDocuments(docManager);
      }
    },
    {
      name: "remove",
      description: "Remove a document from the knowledge base",
      execute: async (args) => {
        if (args.length === 0) {
          return "Please provide a document name to remove.";
        }
        return await handleRemoveDocument(docManager, args[0]);
      }
    },
    {
      name: "search",
      description: "Search through loaded documents",
      execute: async (args) => {
        if (args.length === 0) {
          return "Please provide a search query.";
        }
        return await handleSearchDocuments(docManager, args.join(" "));
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

      const { command, args } = parseCommand(userInput);
      const cmd = commands.find(c => c.name === command);
      
      if (cmd) {
        const response = await cmd.execute(args);
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
      const aiResponse = await getAIResponse(openai, conversation, docManager);
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