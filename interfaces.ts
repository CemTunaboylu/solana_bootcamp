import { Connection, SignatureResult, SystemProgram, Transaction, Keypair, PublicKey, TransactionSignature, sendAndConfirmTransaction } from "@solana/web3.js";
import * as CryptoJS from 'crypto-js';
import { mkdirSync } from 'fs';

export type WalletCustomizerFunction = (wallet: Wallet) => void;

export interface Wallet {
    getIdentifier(): string
    getPublicKey(): PublicKey
    getBalance(): Promise<number>

    setIdentifier(identifier: string): boolean
    setPrivateKey(privateKey: Uint8Array): boolean

    sign(tx: Transaction): Uint8Array
}

export interface TransactionConfirmer {
    confirm(txSignature: TransactionSignature): Promise<SignatureResult>
}

interface PasswordProtected {
    passwordHash: CryptoJS.lib.WordArray
    createPassword(): CryptoJS.lib.WordArray
    updatePassword(oldPassword: string): CryptoJS.lib.WordArray
    removePassword(oldPassword: string): boolean
    approve(password: string): boolean
}

export enum WalletVaultSetResult {
    Successful = 0,
    InvalidIdentifier,
    WalletWithIdentifierAlreadyExists,
    Failed,
}

export enum WalletVaultDelResult {
    Successful = 0,
    InvalidIdentifier,
    NoSuchWallet,
    Failed,
}

export interface WalletVault {
    get(identifier: string): Wallet | null
    set(identifier: string, wallet: Wallet): WalletVaultSetResult
    del(identifier: string, wallet: Wallet): WalletVaultDelResult
}

export interface TaggedRetriever {
    get(tag: string): Array<Wallet>
}