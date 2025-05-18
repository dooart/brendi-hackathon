import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { sendText } from './utils';
import { generateAnswer } from './services';
import { OpenAI } from 'openai';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const app = express();
const port = 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Middleware para CORS
app.use(cors());

// Middleware para processar JSON no body
app.use(bodyParser.json());


function getMessageType(body: any) {
    if (body?.text?.message) return 'text';
    if (body?.audio?.audioUrl) return 'audio';
    return 'other';
}


export async function transcribeAudio(audioUrl: string): Promise<string> {
    let audioBuffer: Buffer;
    try {
        const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        audioBuffer = Buffer.from(audioResponse.data);
    } catch (error) {
        console.error('Falha ao baixar o áudio:', error);
        throw new Error('Falha ao baixar o áudio');
    }

    const tempFilePath = path.join(os.tmpdir(), 'audio.ogg');
    try {
        await fs.promises.writeFile(tempFilePath, audioBuffer);
    } catch (error) {
        console.error('Falha ao salvar o arquivo de áudio:', error);
        throw new Error('Falha ao salvar o arquivo de áudio');
    }

    const audioFile = fs.createReadStream(tempFilePath);

    const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
    });

    console.log('Áudio transcrito com sucesso:', transcription.text);

    try {
        await fs.promises.unlink(tempFilePath);
    } catch (err) {
        console.error('Erro ao deletar o arquivo temporário:', err);
    }

    return transcription.text;
}

// Rota POST que recebe dados e mostra no terminal
app.post('/log', async (req, res) => {

    const { text, phone } = req.body;

    if (phone !== '120363402214967568-group') {
        console.log('Não autorizado, different phone number: ', phone);
        return res.status(400).json({ error: 'Não autorizado' });
    }

    const messageType = getMessageType(req.body);
    let message = '';

    if (messageType === 'text') {
        message = text.message;
    } else if (messageType === 'audio') {
        const audioUrl = req.body.audio.audioUrl;
        message = await transcribeAudio(audioUrl);
    }

    if (!message) {
        return res.status(400).json({ error: 'Nenhuma mensagem recebida' });
    }

    const answer = await generateAnswer(message, phone);

    await sendText(phone, answer);

    res.json({ message: 'Mensagem recebida com sucesso!' });
});

// Inicia o servidor
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log('Aceitando conexões de qualquer origem');
});
