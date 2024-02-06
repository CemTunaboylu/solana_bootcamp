import { Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, Keypair, PublicKey, TransactionSignature, sendAndConfirmTransaction } from "@solana/web3.js";

import { log } from "./logging";
import { Wallet } from "./interfaces";

async function New(): Promise<Wallet> {
    throw new Error("not implemented");
}

async function Transer(fromWallet: Wallet, toPublicKey: PublicKey, lamports: number) {
    throw new Error("not implemented");
}

async function airdrop(toWallet: Wallet, lamports: number) {
    throw new Error("not implemented");
}

async function balance(ofWallet: Wallet): Promise<number> {
    throw new Error("not implemented");
}