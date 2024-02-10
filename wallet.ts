import { Connection, SystemProgram, Transaction, BlockhashWithExpiryBlockHeight, PublicKey, TransactionSignature, SignatureResult, VersionedTransaction } from '@solana/web3.js';

import { logWithTrace } from "./logging";
import { Wallet, TransactionConfirmer } from "./interfaces";

async function New(): Promise<Wallet> {
    throw new Error("not implemented");
}

class TransactionOrError {
    tx: Transaction | null;
    err: Error | null;

    constructor(tx: Transaction | null, err: Error | null) {
        this.tx = tx;
        this.err = err;
    }

    isTransactionFormationFailed(): boolean {
        return (null != this.err) || (null == this.tx)
    }

    getTransaction(): Transaction {
        return this.tx as Transaction
    }
};

export async function prepareTransaction(
    fromWallet: Wallet,
    toPublicKey: PublicKey,
    lamports: number,
    recentBlockHash: BlockhashWithExpiryBlockHeight,
    balanceCheck: boolean = false
): Promise<TransactionOrError> {
    // TODO: this currently is not guaranteed to be consistent
    if (balanceCheck) {
        let currentBalanceInLamports = await fromWallet.getBalance();
        const isBalanceNotEnough = lamports >= currentBalanceInLamports;
        if (isBalanceNotEnough) {
            const errMessage = `Wallet ${fromWallet.getIdentifier()} does not have requested amount of lamports(${lamports}) to send to ${toPublicKey}`
            return new TransactionOrError(null, new Error(errMessage))
        }
    }
    let transaction = new Transaction({
        feePayer: fromWallet.getPublicKey(),
        blockhash: recentBlockHash.blockhash,
        lastValidBlockHeight: recentBlockHash.lastValidBlockHeight
    });
    const transferInstruction = SystemProgram.transfer({
        fromPubkey: fromWallet.getPublicKey(),
        toPubkey: toPublicKey,
        lamports: lamports,
    });
    transaction.add(transferInstruction);
    return new TransactionOrError(transaction, null)
}

function createSignatures(wallets: Wallet[], tx: Transaction): Array<Uint8Array> {
    let signatures: Array<Uint8Array> = new Array<Uint8Array>(wallets.length);
    for (let index = 0; index < wallets.length; index++) {
        const wallet = wallets[index];
        signatures[index] = wallet.sign(tx)
    }
    return signatures;
}

// TODO: make it able to take tx as a parameter
// TODO: add preTransfer and postTransfer
export async function transfer(connection: Connection, fromWallet: Wallet, toPublicKey: PublicKey, lamports: number): Promise<TransactionSignature> {
    const logTrace = 'Transfer'
    let txSignature: TransactionSignature = "";
    try {
        const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash()
        let txOrError: TransactionOrError = await prepareTransaction(fromWallet, toPublicKey, lamports, recentBlockHash)
        if (txOrError.isTransactionFormationFailed()) return txSignature; // return empty hash
        // TODO: check if this tx has been seen before i.e. handle duplicates
        const tx: Transaction = txOrError.getTransaction();
        const signatures = createSignatures([fromWallet], tx)
        const txMessage = tx.compileMessage();
        const versionedTransaction: VersionedTransaction = new VersionedTransaction(txMessage, signatures)
        txSignature = await connection.sendTransaction(versionedTransaction);
    } catch (error) {
        logWithTrace(logTrace, error)
    }
    return txSignature;
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