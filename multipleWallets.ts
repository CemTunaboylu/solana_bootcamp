import { Connection, SystemProgram, Transaction, BlockhashWithExpiryBlockHeight, PublicKey, TransactionSignature, SignatureResult, VersionedTransaction } from '@solana/web3.js';

import { logWithTrace } from "./logging";
import { Wallet, TransactionConfirmer, BalanceChecker, IdentifiedBalanceMap, WalletVaultDelResult } from './interfaces';
import { TransactionOrError, prepareTransaction, transfer, createSignatures, createVersionedTransactionFrom, transferTransaction, UnsignedTransaction } from "./walletFunctionality";
import { recoverNested } from '@solana/spl-token';


async function New(): Promise<Wallet> {
    throw new Error("not implemented");
}

// expects wallets[i] will be transferring lampors[i]
// TODO: add strategies for matching many wallets can send the same amount of lamports to that many wallets, or one wallet (3 strategies) 
function divideIntoEnoughAndLackingBalancedWallets(identifiedBalanceMap: IdentifiedBalanceMap, wallets: Wallet[], lamports: number[]): [Wallet[], Wallet[]] {
    let enough: Wallet[] = new Array<Wallet>();
    let lacking: Wallet[] = new Array<Wallet>();

    // assume that if they are not of same length, the parts that are matching are correct
    const shortestLength = wallets.length < lamports.length ? wallets.length : lamports.length;


    for (let index = 0; index < shortestLength; index++) {
        const wallet = wallets[index];
        const identifier = wallet.getIdentifier();

        if (!identifiedBalanceMap.has(identifier)) {
            // assume that if its balance cannot be retrieved, it does not have enough balance
            lacking.push(wallet);
            continue;
        }
        const balance = identifiedBalanceMap.get(identifier);
        if (balance && balance > lamports[index]) enough.push(wallet)
        else lacking.push(wallet)
    }
    return [enough, lacking]

}
// TODO: have strategies, many to one, one to one: X wallets to X wallet, X wallets to 1 wallet
export async function prepareTransactions(
    fromWallets: Array<Wallet>,
    toPublicKeys: Array<PublicKey>,
    lamports: Array<number>,
    recentBlockHash: BlockhashWithExpiryBlockHeight,
    balanceChecker?: BalanceChecker,
): Promise<Array<TransactionOrError>> {
    let toBeProcessedWallets = fromWallets;
    if (balanceChecker) {
        const identifiedBalanceMap: IdentifiedBalanceMap = await balanceChecker.getBalances(...fromWallets);
        const enoughAndLackingWallets = divideIntoEnoughAndLackingBalancedWallets(identifiedBalanceMap, fromWallets, lamports);
        toBeProcessedWallets = enoughAndLackingWallets[0]
    }
    // assume that if they are not of same length, the parts that are matching are correct
    const shortestLength = Math.min(fromWallets.length, toPublicKeys.length, lamports.length);
    let txOrErrs = new Array<TransactionOrError>(shortestLength);

    for (let index = 0; index < shortestLength; index++) {
        const wallet = toBeProcessedWallets[index];
        const txOrError = await prepareTransaction(wallet, toPublicKeys[index], lamports[index], recentBlockHash)
        let toPut;
        if (txOrError.isTransactionFormationFailed()) {
            const errMessage = `Could not form transaction for wallet ${wallet.getIdentifier()} to send to ${toPublicKeys[index]}, error: ${txOrError.err}`
            toPut = new TransactionOrError(null, new Error(errMessage))
        } else {
            toPut = new TransactionOrError(txOrError.getTransaction(), null)
        }
        txOrErrs[index] = toPut;
    }
    return txOrErrs

}
// TODO: add preTransfer and postTransfer
export async function multiTransfer(
    connection: Connection,
    fromWallets: Wallet[],
    lamports: number[],
    ...toPublicKeys: PublicKey[]): Promise<TransactionSignature[]> {
    const logTrace = 'Transfer'
    let txSignature: TransactionSignature = "";
    try {
        const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash()
        // TODO: inject function to get where to transfer
        // const function to() {}
        const txOrErrors: TransactionOrError[] = await Promise.all(
            fromWallets.map(
                (from, index) => {
                    const amountInLamports = lamports[index];
                    const toPublicKey = toPublicKeys[index];
                    return prepareTransaction(from, toPublicKey, amountInLamports, recentBlockHash)
                }
            )
        )
        const validTransactions = txOrErrors
            .filter(txOrError => !txOrError.isTransactionFormationFailed() && null != txOrError.getTransaction()).map(tx => tx.getTransaction())
        // validTransactions can only be of type Transaction or 
        return transferTransactions(connection, validTransactions)
    } catch (error) {
        return Promise.resolve(new Array<string>())
    }
}


// TODO: add preTransfer and postTransfer
export async function transferTransactions(
    connection: Connection,
    transactions: Array<VersionedTransaction | UnsignedTransaction>,
): Promise<TransactionSignature[]> {
    const logTrace = 'Transfer'
    const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash()
    return Promise.all(
        transactions.map(async element => {
            try {
                const signature = transferTransaction(connection, element);
                return signature;
            }
            catch (error) {
                logWithTrace(logTrace, error)
                return `${error}`;
            }
        })
    )
}

export async function airdrop(connection: Connection, toWallet: Wallet, lamports: number, confirmer?: TransactionConfirmer) {
    const logTrace = 'airdrop'
    const airdropSignature = await connection.requestAirdrop(
        toWallet.getPublicKey(),
        lamports
    )
    if (confirmer) {
        const signatureResult: SignatureResult = await confirmer.confirm(airdropSignature);
        const hasError = signatureResult.err != null
        logWithTrace(logTrace, `confirmation is ${["successful", "failed"][+(hasError)]} `)
    }
}