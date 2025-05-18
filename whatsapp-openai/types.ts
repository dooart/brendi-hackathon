
export interface Account {
    id: string;
    name: string;
}

export interface Transaction {
    id?: string;
    date: string;
    description: string;
    amount: number;
    accountName?: string;
    [key: string]: any;
    category?: string;
}

export interface TransactionResponse {
    data: {
        results: Transaction[];
    };
}

export interface AuthResponse {
    data: {
        apiKey: string;
    };
}

export interface TotalsResult {
    totalReceipts: number;
    totalExpenses: number;
}

export interface AccountStat {
    name: string;
    totalExpense: number;
    transactionCount: number;
}

export interface CardVsNonCardExpenses {
    totalCardExpenses: number;
    totalNonCardExpenses: number;
}

export interface CategorizedTransactions {
    expenses: Transaction[];
    receipts: Transaction[];
}