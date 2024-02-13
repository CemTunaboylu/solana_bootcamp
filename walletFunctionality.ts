import {
    Connection,
    SystemProgram,
    Transaction,
    BlockhashWithExpiryBlockHeight,
    PublicKey,
    TransactionSignature,
    SignatureResult,
    VersionedTransaction,
    Keypair
} from '@solana/web3.js';

import { logWithTrace } from "./logging";
import { Wallet, TransactionConfirmer, BalanceChecker } from "./interfaces";
import { ensureAtLeastOneWalletExists, extractFileName, readKeypairFromfile } from './fileUtilities';
import { PlainWallet } from './plainWallet';
import { WithIdentifier, WithKeypair } from './walletCustomizers';

async function New(filepath: string): Promise<Wallet> {
    await ensureAtLeastOneWalletExists(filepath, Keypair.generate);
    const keypair = await readKeypairFromfile(filepath)
    const identifier = extractFileName(filepath);
    const wallet = new PlainWallet(WithIdentifier(identifier), WithKeypair(keypair));
    return wallet;
}

export class UnsignedTransaction {
    tx: Transaction;
    wallet: Wallet;
    constructor(tx: Transaction, w: Wallet) {
        this.tx = tx
        this.wallet = w
    }
}

export class TransactionOrError {
    tx: VersionedTransaction | UnsignedTransaction | null;
    err: Error | null;

    constructor(tx: VersionedTransaction | UnsignedTransaction | null, err: Error | null) {
        this.tx = tx;
        this.err = err;
    }

    isTransactionFormationFailed(): boolean {
        return (null != this.err) || (null == this.tx)
    }

    getTransaction(): VersionedTransaction | UnsignedTransaction | null {
        return this.tx
    }
};

export async function prepareTransaction(
    fromWallet: Wallet,
    toPublicKey: PublicKey,
    lamports: number,
    recentBlockHash: BlockhashWithExpiryBlockHeight,
    balanceChecker?: BalanceChecker,
    sign: boolean = true
): Promise<TransactionOrError> {
    if (null != balanceChecker && !await balanceChecker.doesHaveEnoughBalance(fromWallet, lamports)) {
        const errMessage = `Wallet ${fromWallet.getIdentifier()} does not have requested amount of lamports(${lamports}) to send to ${toPublicKey}`
        return new TransactionOrError(null, new Error(errMessage))
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
    let validTransaction: UnsignedTransaction | VersionedTransaction
    if (sign) {
        validTransaction = createVersionedTransactionFrom(fromWallet, transaction);
    } else {
        validTransaction = new UnsignedTransaction(transaction, fromWallet);
    }
    return new TransactionOrError(validTransaction, null)
}

export function createVersionedTransactionFrom(fromWallet: Wallet, tx: Transaction) {
    const signatures = createSignatures([fromWallet], tx)
    const txMessage = tx.compileMessage();
    return new VersionedTransaction(txMessage, signatures)
}

export function createSignatures(wallets: Wallet[], tx: Transaction): Array<Uint8Array> {
    let signatures: Array<Uint8Array> = new Array<Uint8Array>(wallets.length);
    for (let index = 0; index < wallets.length; index++) {
        const wallet = wallets[index];
        signatures[index] = wallet.sign(tx)
    }
    return signatures;
}

// TODO: add preTransfer and postTransfer
export async function transfer(
    connection: Connection,
    fromWallet: Wallet,
    lamports: number,
    toPublicKey: PublicKey,
    balanceChecker?: BalanceChecker
): Promise<TransactionSignature> {
    const logTrace = 'transfer'
    let txSignature: TransactionSignature = "";
    try {
        const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash()
        let txOrError: TransactionOrError = await prepareTransaction(fromWallet, toPublicKey, lamports, recentBlockHash, balanceChecker)
        if (txOrError.isTransactionFormationFailed()) return txSignature; // return empty hash
        // TODO: check if this tx has been seen before i.e. handle duplicates
        let tx: VersionedTransaction | UnsignedTransaction | null = txOrError.getTransaction();
        if (null == tx) return txSignature; // should never happen since we checked for isTransactionFormationFailed above
        if (tx instanceof UnsignedTransaction) {
            tx = createVersionedTransactionFrom(tx.wallet, tx.tx)
        }
        txSignature = await connection.sendTransaction(tx);
    } catch (error) {
        logWithTrace(logTrace, error)
    }
    return txSignature;
}

// TODO: add preTransfer and postTransfer
export async function transferTransaction(
    connection: Connection,
    transaction: VersionedTransaction | UnsignedTransaction,
): Promise<TransactionSignature> {
    const logTrace = 'transferTransaction'
    let txSignature: TransactionSignature = "";
    try {
        const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash();
        if (transaction instanceof UnsignedTransaction) {  // needs signature
            if (null == transaction.tx || undefined == transaction.wallet) {
                return txSignature; // return empty, something is wrong
            }
            transaction = createVersionedTransactionFrom(transaction.wallet, transaction.tx)
        }
        txSignature = await connection.sendTransaction(transaction);
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