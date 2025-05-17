import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { sendText } from './utils';
import { generateAnswer } from './services';

const app = express();
const port = 3000;

// Middleware para CORS
app.use(cors());

// Middleware para processar JSON no body
app.use(bodyParser.json());

// Rota POST que recebe dados e mostra no terminal
app.post('/log', async (req, res) => {
    console.log('Body recebido:', req.body);

    const { message, phone } = req.body;

    console.log(`message: ${message}, phone: ${phone}`);

    if (!message) {
        return res.status(400).json({ error: 'Nenhuma mensagem recebida' });
    }

    const answer = await generateAnswer(message);
    console.log(`answer: ${answer}`);

    await sendText(phone, answer);

    res.json({ message: 'Mensagem recebida com sucesso!' });
});

// Inicia o servidor
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log('Aceitando conexões de qualquer origem');
});
