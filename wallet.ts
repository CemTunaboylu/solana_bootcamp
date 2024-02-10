import { Connection, SystemProgram, Transaction, BlockhashWithExpiryBlockHeight, PublicKey, TransactionSignature, SignatureResult, VersionedTransaction } from '@solana/web3.js';

import { logWithTrace } from "./logging";
import { Wallet, TransactionConfirmer } from "./interfaces";

async function New(): Promise<Wallet> {
    throw new Error("not implemented");
}

export async function prepareTransaction(
    fromWallet: Wallet,
    toPublicKey: PublicKey,
    lamports: number,
    recentBlockHash: BlockhashWithExpiryBlockHeight,
    balanceCheck: boolean = false
): Promise<Transaction> {
    if (balanceCheck) {
        let currentBalanceInLamports = await fromWallet.getBalance();
        const isBalanceNotEnough = lamports >= currentBalanceInLamports;
        if (isBalanceNotEnough) {
            const errMessage = `Wallet ${fromWallet.getIdentifier()} does not have requested amount of lamports(${lamports}) to send to ${toPublicKey}`
            throw new Error(errMessage);
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
    return transaction
}

// TODO: make it able to take tx as a parameter
export async function transfer(connection: Connection, fromWallet: Wallet, toPublicKey: PublicKey, lamports: number): Promise<TransactionSignature> {
    const logTrace = 'Transfer'
    let txSignature: TransactionSignature = "";
    try {
        const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash()
        let signatures: Array<Uint8Array> = new Array<Uint8Array>(1);
        let tx: Transaction = await prepareTransaction(fromWallet, toPublicKey, lamports, recentBlockHash)
        signatures[0] = fromWallet.sign(tx)
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
        logWithTrace(logTrace, `confirmation result - ${signatureResult} : ${["successful", "failed"][+(signatureResult.err != null)]} `)
    }
}