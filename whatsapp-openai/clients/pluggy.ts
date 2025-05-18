import { TransactionResponse } from "../types";
import { Transaction } from "../types";
import { Account } from "../types";
import pluggy from "@api/pluggy";
import { AuthResponse } from "../types";
import { accounts } from "../consts";

// Autenticação com a API Pluggy
async function authenticatePluggy(): Promise<string> {
    let pluggyApikey = '';

    const response = await pluggy.authCreate({
        clientId: 'ec735b8b-6c98-49d5-9e2e-4e4e81aaded6',
        clientSecret: '713f9513-bfd9-4509-821c-0a77278aa868'
    }).catch(err => console.error(err));

    if (response) {
        pluggyApikey = (response as AuthResponse).data.apiKey;
    }

    pluggy.auth(pluggyApikey);
    return pluggyApikey;
}

// Busca transações de uma conta específica
async function fetchAccountTransactions(account: Account): Promise<Transaction[]> {
    try {
        const transResponse = await pluggy.transactionsList({
            accountId: account.id,
            from: '2025-04-01 00:00:00',
            to: '2025-04-30 23:59:59',
            pageSize: 500,
        }) as TransactionResponse;

        // Normaliza as transações
        return transResponse.data.results.map(transaction => {
            const isCard = account.name.includes('Cartão');
            const normalizedAmount = isCard
                ? -transaction.amount
                : transaction.amount;

            return {
                ...transaction,
                amount: normalizedAmount,
                accountName: account.name
            };
        });
    } catch (error) {
        console.error(`Error fetching transactions for account ${account.name}:`, error);
        return [];
    }
}

// Busca transações de todas as contas
async function fetchAllTransactions(): Promise<Transaction[]> {
    let allTransactions: Transaction[] = [];

    for (const account of accounts) {
        const accountTransactions = await fetchAccountTransactions(account);
        allTransactions = [...allTransactions, ...accountTransactions];
    }

    return allTransactions;
}

export { authenticatePluggy, fetchAllTransactions };