import { Keypair, PublicKey, Transaction, Connection } from "@solana/web3.js";
import { ed25519 } from '@noble/curves/ed25519';

import { queryBalancesConcurrently } from "./consistent_balance";
import { Wallet, BalanceChecker, WalletCustomizerFunction, Ed25519SecretKey, IdentifiedBalanceMap } from './interfaces';
import { logWithTrace } from "./logging";


const sign = (
    message: Parameters<typeof ed25519.sign>[0],
    secretKey: Ed25519SecretKey,
) => ed25519.sign(message, secretKey.slice(0, 32));

export const verify = ed25519.verify;

type timestamp = number;
const OneHour = 3600000;

export class ConcurrentBalanceChecker implements BalanceChecker {
    conn: Connection;
    cache: Map<string, [number, timestamp]>;
    due: number
    static noOrInvalidBalance = null
    constructor(conn: Connection, due: number = OneHour) {
        this.conn = conn;
        this.cache = new Map()
        this.due = due
    }

    cachedBalanceWithNullIfDue(identifier: string): number | null { // null indicates not in the cahce OR it is due, time to fetch it 
        if (this.cache.has(identifier)) return ConcurrentBalanceChecker.noOrInvalidBalance;
        const balanceAndTimestamp = this.cache.get(identifier);
        if (balanceAndTimestamp?.[1] >= this.due)
            return ConcurrentBalanceChecker.noOrInvalidBalance
        return balanceAndTimestamp?.[0] as number
    }

    divideValidAndDueByTimestamp(...wallets: Wallet[]): [IdentifiedBalanceMap, Wallet[]] {
        let due: Wallet[] = new Array<Wallet>();
        let usable: Map<string, number> = new Map<string, number>();
        wallets.forEach(wallet => {
            const balance = this.cachedBalanceWithNullIfDue(wallet.getIdentifier())
            if (ConcurrentBalanceChecker.noOrInvalidBalance == balance) due.push(wallet)
            else usable.set(wallet.getIdentifier(), balance as number)
        });
        return [usable, due]
    }

    async updateBalances(...wallets: Wallet[]) {
        const identifiedBalanceMap = await queryBalancesConcurrently(this.conn, ...wallets);
        for (const key in identifiedBalanceMap.keys()) {
            const balance = identifiedBalanceMap.get(key);
            if (balance) {
                this.cache.set(key, [balance, Date.now()])
            }
            // if I cannot get it, I don't trust the old information
            // TODO: make this a strategy
            else this.cache.delete(key)
        }
    }
    async getBalance(wallet: Wallet): Promise<number | null> {
        const identifier = wallet.getIdentifier();
        const oldBalanceOrNull = this.cachedBalanceWithNullIfDue(identifier);
        if (ConcurrentBalanceChecker.noOrInvalidBalance == oldBalanceOrNull)
            return ConcurrentBalanceChecker.noOrInvalidBalance;

        const identifiedBalanceMap = await queryBalancesConcurrently(this.conn, wallet);
        if (!identifiedBalanceMap.has(identifier)) return ConcurrentBalanceChecker.noOrInvalidBalance;
        const timestamp = Date.now()
        const identifiedBalance = identifiedBalanceMap.get(identifier)
        if (ConcurrentBalanceChecker.noOrInvalidBalance != identifiedBalance) {
            this.cache.set(identifier, [identifiedBalance, timestamp]);
        } else if (this.cache.has(identifier)) {
            this.cache.delete(identifier)
            return ConcurrentBalanceChecker.noOrInvalidBalance;
        }
        return identifiedBalance ? identifiedBalance : 0;
    }

    async getBalances(...wallets: Wallet[]): Promise<IdentifiedBalanceMap> {
        const logTrace = "getBalances"
        let usableAndDue = this.divideValidAndDueByTimestamp(...wallets)
        let identifiedBalanceMap: IdentifiedBalanceMap = usableAndDue[0];
        await this.updateBalances(...usableAndDue[1])
        let newlyFetchedAndEmpty = this.divideValidAndDueByTimestamp(...usableAndDue[1])
        // should never happen but logs the case where there are still wallets that are due
        if (newlyFetchedAndEmpty[1].length < 0) logWithTrace(logTrace, `new balance fetching was partial ${newlyFetchedAndEmpty[1]} `)

        newlyFetchedAndEmpty[0].forEach((bl: number | null, i: string) => {
            if (bl)
                identifiedBalanceMap.set(i, bl);
        })
        return identifiedBalanceMap;
    }

    doesHaveEnoughBalance(wallet: Wallet, forAmountInLamports: number): boolean {
        const identifier = wallet.getIdentifier();
        if (!this.cache.has(identifier)) return false
        const balanceAndTimestamp = this.cache.get(identifier);
        const balance = balanceAndTimestamp?.[0]
        return balance as number > forAmountInLamports
    }
}

export class TestWallet implements Wallet {
    identifier: string;
    keypair: Keypair;

    static normalize_identifier(identifier: string): string {
        return identifier.trim().normalize().toLowerCase();
    }

    getIdentifier(): string {
        return this.identifier;
    }

    getPublicKey(): PublicKey {
        return this.keypair.publicKey;
    }

    setIdentifier(identifier: string): boolean {
        this.identifier = TestWallet.normalize_identifier(identifier);
        return true;
    }
    setPrivateKey(privateKey: Uint8Array): boolean {
        this.keypair = Keypair.fromSecretKey(privateKey);
        return true;
    }

    sign(tx: Transaction): Uint8Array {
        const messageData = tx.compileMessage().serialize();
        return sign(messageData, this.keypair.secretKey);
    }

    constructor(...customValueFuncs: WalletCustomizerFunction[]) {
        // default values
        this.identifier = "test";
        this.keypair = Keypair.generate();

        customValueFuncs.forEach(f => {
            f(this);
        });
    }
}