import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateAnswer(message: string) {
    const data = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
            { role: "system", content: "Você é um assistente muito útil que se chama Zucleide. Sempre se apresente como Zucleide em todas as respostas." },
            { role: "user", content: message }
        ],
        temperature: 1,
    });

    const response = data.choices[0].message.content;

    if (!response) {
        return 'Desculpe, não consegui entender a sua mensagem. Por favor, tente novamente.';
    }

    return response;
}