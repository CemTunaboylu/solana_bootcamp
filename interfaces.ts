import { Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, Keypair, PublicKey, TransactionSignature, sendAndConfirmTransaction } from "@solana/web3.js";
import * as CryptoJS from 'crypto-js';

export type WalletCustomizerFunction = (wallet: Wallet) => void;

export interface Wallet {
    identifier: string
    publicKey: PublicKey
    privateKeyFile: string
    balance: number

    new(...customValueFuncs: WalletCustomizerFunction[]): Wallet
}

interface PasswordProtected {
    passwordHash: CryptoJS.lib.WordArray
    createPassword(): CryptoJS.lib.WordArray
    updatePassword(oldPassword: string): CryptoJS.lib.WordArray
    removePassword(oldPassword: string): boolean
    approve(password: string): boolean
}

enum WalletVaultSetResult {
    Successful = 0,
    InvalidIdentifier,
    WalletWithIdentifierAlreadyExists,
    Failed,
}

enum WalletVaultDelResult {
    Successful = 0,
    NoSuchIdentifier,
    Failed,
}
interface WalletVault {
    identifierWalletMap: Map<string, Wallet>

    get(identifier: string): Wallet
    set(identifier: string, wallet: Wallet): WalletVaultSetResult
    del(identifier: string, wallet: Wallet): WalletVaultDelResult
}