
import { Connection, PublicKey } from "@solana/web3.js";

import { Wallet, BalanceChecker, IdentifiedBalanceMap } from './interfaces';

import { logWithTrace } from "./logging";

type timestamp = number;
const OneHour = 3600000;

async function queryBalancesConcurrently(connection: Connection, ...wallets: Wallet[]): Promise<IdentifiedBalanceMap> {
    const balances = await Promise.all(
        wallets.map(
            async wallet => {
                const publicKey = wallet.getPublicKey();
                const identifier = wallet.getIdentifier();
                try {
                    const balance = await connection.getBalance(publicKey);
                    return { identifier, balance };
                } catch (error) {
                    console.error(`Error querying balance for ${publicKey}: ${error}`);
                    return { identifier, balance: 0 };
                }
            })
    );
    let map = new Map<string, number>();
    for (let index = 0; index < balances.length; index++) {
        const element = balances[index];
        map.set(element.identifier, element.balance);
    }
    return map;
}

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
        if (!this.cache.has(identifier)) return ConcurrentBalanceChecker.noOrInvalidBalance;
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

    async doesHaveEnoughBalance(wallet: Wallet, forAmountInLamports: number): Promise<boolean> {
        const identifier = wallet.getIdentifier();
        const balance = await this.getBalance(wallet);
        if (balance)
            return balance as number > forAmountInLamports
        return false
    }
}