import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { Account, AccountStat, AuthResponse, CardVsNonCardExpenses, CategorizedTransactions, TotalsResult, Transaction, TransactionResponse } from './types';
import { accounts } from './consts';
import { authenticatePluggy } from './clients/pluggy';
import { fetchAllTransactions } from './clients/pluggy';
import fs from 'fs';
import path from 'path';
import { sendText } from './utils';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Categorias de despesas e suas palavras-chave
const expenseCategories = {
    "apoio": ["doação", "ajuda", "caridade", "contribuição", "lenice", "paulo nogueira", "ana gabriella", "mirian", "99 tecnologia"],
    "moradia": ["aluguel", "condomínio", "iptu", "luz", "água", "gás", "internet", "telefone", "reforma", "bmb", "imobiliaria", "piramide", "imoveis", "transferência enviada|claro", "edp sao paulo", "pjbank pagamentos s a", "maria aparecida braz melgar"],
    "alimentação": ["restaurante", "mercado", "supermercado", "ifood", "rappi", "delivery", "lanche", "salgado", "oxxo", "o postinho conven", "sushi", "churrasco", "pizzaria", "hamburgueria", "lanchonete", "padaria", "padaria doce", "padaria doce amor", "padaria doce amor a"],
    "locomoção": ["uber", "taxi", "ônibus", "metrô", "combustível", "estacionamento", "pedágio", "zae sao", "sandra pagano", "onibus", "gasolina", "gtlavarapido"],
    "saúde": ["farmácia", "médico", "hospital", "consulta", "exame", "remédio", "plano de saúde", "ingrid dousseau",],
    "diversão": ["cinema", "teatro", "show", "netflix", "spotify", "amazon prime", "disney+", "viagem", "hotel"],
    "bens consumíveis": ["roupa", "sapato", "eletrônico", "celular", "computador", "móvel", "decoração"],
    "educação": ["curso", "livro", "faculdade", "escola", "mensalidade", "material escolar"],
    "impostos & contabilidade": ["imposto", "contador", "declaração"]
};

// Carrega o mapeamento de descrições exatas para categorias
function loadCategoryDescriptions(): Record<string, string[]> {
    try {
        const data = fs.readFileSync('category-descriptions.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao carregar o arquivo de descrições de categorias:', error);
        return {
            "Apoio": [],
            "Moradia": [],
            "Alimentação": [],
            "Locomoção": [],
            "Saúde": [],
            "Diversão": [],
            "Bens Consumíveis": [],
            "Educação": [],
            "Impostos & Contabilidade": [],
            "Outros": [],
            "Receita": []
        };
    }
}

// Identifica a categoria de uma despesa com base na descrição
function identifyExpenseCategory(description: string): string {
    // Primeiro, verifica se há uma correspondência exata no arquivo de categorias
    const categoryDescriptions = loadCategoryDescriptions();

    for (const [category, descriptions] of Object.entries(categoryDescriptions)) {
        if (descriptions.includes(description)) {
            return category;
        }
    }

    // Se não encontrar correspondência exata, usa o método de palavras-chave
    const lowerDescription = description.toLowerCase();

    for (const [category, keywords] of Object.entries(expenseCategories)) {
        if (keywords.some(keyword => keyword && lowerDescription.includes(keyword))) {
            return category;
        }
    }

    return "Outros"; // Categoria padrão se nenhuma correspondência for encontrada
}

// Verifica se o usuário deseja recategorizar despesas
async function checkRecategorization(message: string): Promise<{ user_wants_to_recategorize: boolean } | null> {
    try {
        const data = await openai.chat.completions.create({
            model: "o4-mini",
            messages: [
                {
                    role: "system",
                    content: `Pela mensagem do usuário, ele gostaria de recategorizar suas despesas? Ou seja, mudar uma categoria para uma outra de alguma despesa?
                    
                    Devolva um JSON com a seguinte estrutura:
                    {
                        "user_wants_to_recategorize": boolean
                    }

                    `
                },
                { role: "user", content: message }
            ],
            response_format: { type: "json_object" }
        });

        const content = data.choices[0].message.content;
        if (!content) return null;

        const parsedResponse = JSON.parse(content) as { user_wants_to_recategorize: boolean };
        return parsedResponse;
    } catch (error) {
        console.error('Erro ao verificar recategorização:', error);
        return null;
    }
}

async function updateCategoriesMemory(message: string) {
    const categoryDescriptions = loadCategoryDescriptions();

    const data = await openai.chat.completions.create({
        model: "o4-mini",
        messages: [
            {
                role: "system",
                content: `Você é um assistente de reorganização de categorias de despesas. 
                
                Abaixo está uma lista de categorias e seus respectivos matchs exatos em formato de string. Cada categoria tem um array de matchs exatos. Você deve usar exatamente as descrições e os nomes das categorias que estão abaixo.

                ${JSON.stringify(categoryDescriptions)}

                Somente use esses matchs exatos para recategorizar as despesas de acordo com o que o usuário enviou.
                Caso a mensagem do usuário esteja com algum tipo de erro de digitação, tente identificar o erro e excolher o melhor match para recategorizar a despesa.

                Se você achar que não um match claro, pode deixar essa categoria sem reorganizar.
                Caso você não consiga identificar nenhuma categoria para reorganizar com confiança, devolva um array vazio.
                
                Analise o que o usuário enviou e devolva um JSON com as seguintes chaves:

                {
                    "categoriesToRecategorize": {
                        description: string,
                        oldCategory: string,
                        newCategory: string,
                    }[]
                }
                
                Onde:
                - oldCategory é a categoria antiga da despesa
                - newCategory é a nova categoria da despesa
                - description é a descrição da despesa
                `
            },
            {
                role: "user",
                content: message
            }
        ],
        response_format: { type: "json_object" }
    });

    const content = data.choices[0].message.content;
    if (!content) return null;

    const parsedResponse = JSON.parse(content) as { categoriesToRecategorize: { description: string, oldCategory: string, newCategory: string }[] };

    if (parsedResponse.categoriesToRecategorize && parsedResponse.categoriesToRecategorize.length > 0) {
        try {
            // Read the current category descriptions file
            const categoryFilePath = path.join(__dirname, 'category-descriptions.json');
            const categoryData = await fs.promises.readFile(categoryFilePath, 'utf8');
            const categories = JSON.parse(categoryData);

            // Process each item to be recategorized
            for (const item of parsedResponse.categoriesToRecategorize) {
                const { description, oldCategory, newCategory } = item;

                // Skip if categories don't exist
                if (!categories[oldCategory] || !categories[newCategory]) {
                    console.log(`Skipping recategorization for "${description}": Category not found`);
                    continue;
                }

                // Find the description in the old category
                const index = categories[oldCategory].findIndex((desc: string) => desc === description);
                if (index !== -1) {
                    // Remove from old category
                    categories[oldCategory].splice(index, 1);

                    // Add to new category if not already there
                    if (!categories[newCategory].includes(description)) {
                        categories[newCategory].push(description);
                    }

                    console.log(`Recategorized "${description}" from ${oldCategory} to ${newCategory}`);
                } else {
                    console.log(`Description "${description}" not found in category ${oldCategory}`);
                }
            }

            // Save the updated categories back to the file
            await fs.promises.writeFile(
                categoryFilePath,
                JSON.stringify(categories, null, 2),
                'utf8'
            );

            // Count items in "Outros" category
            const othersCount = categories["Outros"] ? categories["Outros"].length : 0;

            console.log('Categories updated successfully');
            return { ...parsedResponse, othersCount };
        } catch (error) {
            console.error('Error updating categories:', error);
            return null;
        }
    }
}

// Separa transações em despesas e receitas, excluindo transações específicas e adicionando categorias
function categorizeTransactions(transactions: Transaction[]): CategorizedTransactions {
    // Filtra transações que não contêm strings específicas
    const filteredTransactions = transactions.filter(transaction => {
        const description = transaction.description.toLowerCase();
        return !(
            description.includes("daniel martins frageri") ||
            description.includes("pagamento de fatura") ||
            description.includes("pagamento recebido") ||
            description.includes("resgate rdb") ||
            description.includes("aplicação rdb")
        );
    });

    // Verifica se o usuário deseja recategorizar despesas


    // Adiciona categoria a cada transação (apenas para despesas)
    const categorizedTransactions = filteredTransactions.map(transaction => {
        const category = transaction.amount < 0 ? identifyExpenseCategory(transaction.description) : "Receita";

        return {
            ...transaction,
            category
        };
    });

    // Atualiza o arquivo category-descriptions.json com novas descrições
    try {
        const categoryDescriptions = loadCategoryDescriptions();
        const newDescriptions: Record<string, string[]> = {};

        // Inicializa newDescriptions com as categorias existentes
        Object.keys(categoryDescriptions).forEach(category => {
            newDescriptions[category] = [];
        });

        // Verifica transações que não estão no arquivo
        categorizedTransactions.forEach(transaction => {
            const { description, category } = transaction;

            // Verifica se a categoria existe no arquivo e a cria se não existir
            if (!categoryDescriptions[category]) {
                categoryDescriptions[category] = [];
            }

            // Garante que a categoria também existe em newDescriptions
            if (!newDescriptions[category]) {
                newDescriptions[category] = [];
            }

            // Verifica se a descrição já existe na categoria
            if (!categoryDescriptions[category].includes(description)) {
                newDescriptions[category].push(description);
            }
        });

        // Adiciona novas descrições ao arquivo existente, garantindo que não haja duplicatas
        Object.keys(newDescriptions).forEach(category => {
            if (newDescriptions[category].length > 0) {
                // Combina os arrays e remove duplicatas usando Set
                const combinedDescriptions = [
                    ...categoryDescriptions[category],
                    ...newDescriptions[category]
                ];
                categoryDescriptions[category] = [...new Set(combinedDescriptions)];
            }
        });

        // Salva o arquivo atualizado
        fs.writeFileSync(
            'category-descriptions.json',
            JSON.stringify(categoryDescriptions, null, 2),
            'utf8'
        );

        console.log('Arquivo category-descriptions.json atualizado com novas descrições');
    } catch (error) {
        console.error('Erro ao atualizar o arquivo category-descriptions.json:', error);
    }

    return {
        expenses: categorizedTransactions.filter(transaction => transaction.amount < 0),
        receipts: categorizedTransactions.filter(transaction => transaction.amount > 0)
    };
}

// Formata as despesas para o prompt
function formatExpensesForPrompt(expenses: Transaction[]): string {
    return expenses.map((transaction, index) => `
            --- Despesa ${index + 1} ---
            Data: ${transaction.date}
            Descrição: ${transaction.description}
            Valor: ${transaction.amount}
            Conta: ${transaction.accountName}
            Categoria: ${transaction.category || 'Outros'}
            `).join('');
}

// Formata as receitas para o prompt
function formatReceiptsForPrompt(receipts: Transaction[]): string {
    return receipts.map((transaction, index) => `
            --- Receita ${index + 1} ---
            Data: ${transaction.date}
            Descrição: ${transaction.description}
            Valor: ${transaction.amount}
            Conta: ${transaction.accountName}
            Categoria: ${transaction.category || 'Outros'}
            `).join('');
}

// Calcula totais de receitas e despesas
function calculateTotals(receipts: Transaction[], expenses: Transaction[]): TotalsResult {
    return {
        totalReceipts: receipts.reduce((acc, curr) => acc + curr.amount, 0),
        totalExpenses: expenses.reduce((acc, curr) => acc + curr.amount, 0)
    };
}

// Calcula estatísticas por conta
function calculateAccountStats(accounts: Account[], expenses: Transaction[], receipts: Transaction[]): AccountStat[] {
    return accounts.map(account => {
        const accountExpenses = expenses.filter(t => t.accountName === account.name);
        const totalAmount = accountExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        const accountTransactions = [...accountExpenses, ...receipts.filter(t => t.accountName === account.name)];

        return {
            name: account.name,
            totalExpense: Math.abs(totalAmount),
            transactionCount: accountTransactions.length
        };
    });
}

// Calcula gastos em cartões vs contas correntes
function calculateCardVsNonCardExpenses(accounts: Account[], expenses: Transaction[]): CardVsNonCardExpenses {
    const cardAccounts = accounts.filter(a => a.name.includes('Cartão'));
    const nonCardAccounts = accounts.filter(a => !a.name.includes('Cartão'));

    const cardExpenses = expenses.filter(t => cardAccounts.some(a => t.accountName === a.name));
    const nonCardExpenses = expenses.filter(t => nonCardAccounts.some(a => t.accountName === a.name));

    return {
        totalCardExpenses: Math.abs(cardExpenses.reduce((acc, curr) => acc + curr.amount, 0)),
        totalNonCardExpenses: Math.abs(nonCardExpenses.reduce((acc, curr) => acc + curr.amount, 0))
    };
}

// Calcula o total de gastos por categoria
function calculateExpensesByCategory(expenses: Transaction[]): Record<string, number> {
    const categorySums: Record<string, number> = {};

    expenses.forEach(expense => {
        const category = expense.category || 'Outros';
        if (!categorySums[category]) {
            categorySums[category] = 0;
        }
        categorySums[category] += Math.abs(expense.amount);
    });

    return categorySums;
}

// Cria o prompt do sistema para o OpenAI
function createSystemPrompt(
    expensesPrompt: string,
    receiptsPrompt: string,
    totals: TotalsResult,
    accountStats: AccountStat[],
    cardVsNonCardExpenses: CardVsNonCardExpenses,
    expensesByCategory: Record<string, number>
): string {
    return `Você é o Tio Patinhas e me ajuda a entender e analisar minhas despesas e receitas.
                
                Desse mês, minhas despesas foram:
                ${expensesPrompt}

                E minhas receitas foram:
                ${receiptsPrompt}
                
                Total de receitas: R$ ${totals.totalReceipts}
                Total de despesas: R$ ${totals.totalExpenses}
                
                Estatísticas por conta:
                ${accountStats.map(stat => `- ${stat.name}: R$ ${stat.totalExpense.toFixed(2)} (${stat.transactionCount} transações)`).join('\n')}
                
                Total gasto em cartões: R$ ${cardVsNonCardExpenses.totalCardExpenses.toFixed(2)}
                Total gasto em contas (exceto cartões): R$ ${cardVsNonCardExpenses.totalNonCardExpenses.toFixed(2)}
                
                Resumo de gastos por categoria:
                ${Object.entries(expensesByCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([category, amount]) => `- ${category}: R$ ${amount.toFixed(2)}`)
            .join('\n')}
                
                Não tente formatar a sua resposta, apenas responda de forma objetiva, direta e clara. Use listas enumeradas quando for necessário para me responder, por favor!
                
                Tente adaptar sua resposta, mantendo o tom de voz do Tio Patinhas, mas não se esqueça de me responder de forma direta e objetiva.
                `;
}



// Gera resposta usando OpenAI
async function generateOpenAIResponse(systemPrompt: string, userMessage: string): Promise<string | undefined> {

    const data = await openai.chat.completions.create({
        model: "o4-mini",
        messages: [
            {
                role: "system", content: systemPrompt
            },
            { role: "user", content: userMessage }
        ],
    });

    return data.choices[0].message.content ?? 'Não consegui processar sua mensagem, me desculpe.';
}

// Função principal que coordena todo o processo
export async function generateAnswer(message: string, phone: string): Promise<string> {
    // Autenticar com Pluggy
    await authenticatePluggy();

    // Buscar todas as transações
    const transactions = await fetchAllTransactions();

    // Verificar se o usuário deseja recategorizar despesas
    const isRecategorization = await checkRecategorization(message);

    if (isRecategorization?.user_wants_to_recategorize) {
        const recategorizedCategories = await updateCategoriesMemory(message);

        if (recategorizedCategories) {
            const updatedCategoriesMessage = "Categorias atualizadas: \n" +
                recategorizedCategories.categoriesToRecategorize
                    .map((item: { description: any; newCategory: any; }) => `${item.description} -> ${item.newCategory}`)
                    .join('\n');

            // Adicionar informação sobre a quantidade de itens na categoria "Outros"
            const othersCountMessage = `\n\nQuantidade de itens na categoria "Outros": ${recategorizedCategories.othersCount}`;

            return updatedCategoriesMessage + othersCountMessage;
        }

    }

    // Categorizar transações
    const { expenses, receipts } = categorizeTransactions(transactions);

    // Formatar transações para o prompt
    const expensesPrompt = formatExpensesForPrompt(expenses);
    const receiptsPrompt = formatReceiptsForPrompt(receipts);

    // Calcular totais
    const totals = calculateTotals(receipts, expenses);

    // Calcular estatísticas
    const accountStats = calculateAccountStats(accounts, expenses, receipts);
    const cardVsNonCardExpenses = calculateCardVsNonCardExpenses(accounts, expenses);

    // Calcular gastos por categoria
    const expensesByCategory = calculateExpensesByCategory(expenses);

    // Criar prompt do sistema
    const systemPrompt = createSystemPrompt(
        expensesPrompt,
        receiptsPrompt,
        totals,
        accountStats,
        cardVsNonCardExpenses,
        expensesByCategory
    );

    // Gerar resposta
    const answer = await generateOpenAIResponse(systemPrompt, message);

    if (!answer) {
        return 'Desculpe, não consegui entender a sua mensagem. Por favor, tente novamente.';
    }

    return answer;
}