import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { ed25519 } from '@noble/curves/ed25519';

import { Wallet, WalletCustomizerFunction } from './interfaces';

type Ed25519SecretKey = Uint8Array;

const sign = (
    message: Parameters<typeof ed25519.sign>[0],
    secretKey: Ed25519SecretKey,
) => ed25519.sign(message, secretKey.slice(0, 32));

export const verify = ed25519.verify;

export class TestWallet implements Wallet {
    identifier: string;
    keypair: Keypair;
    balance: number

    getIdentifier(): string {
        return this.identifier;
    }

    getPublicKey(): PublicKey {
        return this.keypair.publicKey;
    }

    getBalance(): Promise<number> {
        return Promise.resolve(this.balance);
    }

    setIdentifier(identifier: string): boolean {
        this.identifier = identifier;
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
        this.balance = 0;

        customValueFuncs.forEach(f => {
            f(this);
        });
    }
}