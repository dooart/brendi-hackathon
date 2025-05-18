# Study Assistant

A powerful AI-powered study assistant that helps you learn, take notes, and review content effectively. The application combines modern AI capabilities with proven learning techniques like spaced repetition and the Zettelkasten method.

## Features

- 🤖 **AI-Powered Chat**: Interact with an AI assistant that can help you understand concepts and automatically create notes from your conversations
- 📝 **Smart Note-Taking**: Automatic note creation when important concepts are detected in conversations
- 🧠 **Spaced Repetition System (SRS)**: Review your notes at optimal intervals for better retention
- 🔄 **Zettelkasten Method**: Visualize connections between your notes in an interactive knowledge graph
- 📚 **Document Management**: Upload and process study materials (PDFs supported)
- 🎯 **Review System**: Test your knowledge with AI-generated questions based on your notes

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Database**: SQLite (better-sqlite3)
- **AI Integration**: OpenAI API and local models (Ollama)
- **Document Processing**: PDF.js and pdf-parse

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key (for OpenAI features)
- Ollama (optional, for local model support)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd study-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
OPENAI_API_KEY=your_openai_api_key
PORT=3001
```

4. Start the development server:
```bash
npm start
```

## Project Structure

- `/web` - Frontend React application
- `/server` - Backend Express server
- `/src` - Source code
  - `/components` - React components
  - `/utils` - Utility functions
  - `/database` - Database management
  - `/documents` - Document processing
  - `/notes` - Note management system

## Features in Detail

### AI Chat
- Supports both OpenAI and local models (Ollama)
- Automatic note creation from conversations
- Markdown formatting for better readability

### Note System
- Automatic detection of important concepts
- Tag-based organization
- Duplicate detection to prevent redundant notes

### Spaced Repetition
- Implements the SuperMemo 2 algorithm
- Tracks review intervals and performance
- Adaptive scheduling based on your performance

### Zettelkasten View
- Interactive knowledge graph visualization
- Shows connections between related notes
- Color-coded relationships based on tags and content

### Document Management
- PDF upload and processing
- Text extraction and analysis
- Integration with note system

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License. 