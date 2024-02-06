import { Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, Keypair, PublicKey, TransactionSignature, sendAndConfirmTransaction } from "@solana/web3.js";

import { log } from "./logging";
import { Wallet } from "./interfaces";

async function New(): Promise<Wallet> {
    throw new Error("not implemented");
}

async function Transer(fromWallet: Wallet, toPublicKey: PublicKey, lamports: number) {
    throw new Error("not implemented");
}

async function airdrop(connection: Connection, toWallet: Wallet, lamports: number, confirmer?: TransactionConfirmer) {
    const logTrace = 'airdrop'
    const airdropSignature = await connection.requestAirdrop(
        toWallet.getPublicKey(),
        lamports
    )
    if (confirmer) {
        const signatureResult: SignatureResult = await confirmer.confirm(airdropSignature);
        logWithTrace(logTrace, "confirmation result - ", signatureResult)
    }
}

async function balance(ofWallet: Wallet): Promise<number> {
    throw new Error("not implemented");
}