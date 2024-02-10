import { Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, BlockhashWithExpiryBlockHeight, PublicKey, TransactionSignature, sendAndConfirmTransaction, SignatureResult, VersionedTransaction } from '@solana/web3.js';

import { logWithTrace } from "./logging";
import { Wallet, TransactionConfirmer } from "./interfaces";

async function New(): Promise<Wallet> {
    throw new Error("not implemented");
}

export async function prepareTransaction(
    fromWallet: Wallet,
    toPublicKey: PublicKey,
    lamports: number,
    recentBlockHash?: BlockhashWithExpiryBlockHeight,
    lastValidBlockHeight?: number
) {
    let currentBalanceInLamports = await fromWallet.getBalance();
    const isBalanceNotEnough = lamports >= currentBalanceInLamports;
    if (isBalanceNotEnough) {
        const errMessage = `Wallet ${fromWallet.getIdentifier()} does not have requested amount of lamports(${lamports}) to send to ${toPublicKey}`
        throw new Error(errMessage);
    }

    return new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: fromWallet.getPublicKey(),
            toPubkey: toPublicKey,
            lamports: lamports,
            // if recentBlockHash is given, provide it
            ... (recentBlockHash != null && {
                recentBlockHash: recentBlockHash,
            }),
            // if lastValidBlockHeight is given, provide it
            ... (lastValidBlockHeight != null && {
                lastValidBlockHeight: lastValidBlockHeight,
            })
        })
    )
}

async function Transfer(connection: Connection, fromWallet: Wallet, toPublicKey: PublicKey, lamports: number) {
    const logTrace = 'Transfer'
    try {
        const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash()
        let tx: Transaction = await prepareTransaction(fromWallet, toPublicKey, lamports, recentBlockHash)
        let signatures: Array<Uint8Array> = new Array<Uint8Array>(1);
        signatures[0] = fromWallet.sign(tx)
        const txMessage = tx.compileMessage();
        const versionedTransaction: VersionedTransaction = new VersionedTransaction(txMessage, signatures)
        connection.sendTransaction(versionedTransaction);
    } catch (error) {
        logWithTrace(logTrace, error)
    }
}

export async function airdrop(connection: Connection, toWallet: Wallet, lamports: number, confirmer?: TransactionConfirmer) {
    const logTrace = 'airdrop'
    const airdropSignature = await connection.requestAirdrop(
        toWallet.getPublicKey(),
        lamports
    )
    if (confirmer) {
        const signatureResult: SignatureResult = await confirmer.confirm(airdropSignature);
        logWithTrace(logTrace, `confirmation result - ${signatureResult} : ${["successful", "failed"][+(signatureResult.err != null)]}`)
    }
}