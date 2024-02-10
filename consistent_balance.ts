import { Connection, PublicKey } from "@solana/web3.js";

export async function queryBalancesConcurrently(connection: Connection, ...publicKeys: PublicKey[]) {
    const balances = await Promise.all(
        publicKeys.map(async publicKey => {
            try {
                const balance = await connection.getBalance(publicKey);
                return { publicKey, balance };
            } catch (error) {
                console.error(`Error querying balance for ${publicKey}: ${error}`);
                return { publicKey, balance: null };
            }
        })
    );

    return balances;
}