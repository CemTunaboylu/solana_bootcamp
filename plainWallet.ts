import { Keypair, PublicKey, Transaction, Connection } from "@solana/web3.js";
import { ed25519 } from '@noble/curves/ed25519';

import { Wallet, WalletCustomizerFunction, Ed25519SecretKey } from './interfaces';


const sign = (
    message: Parameters<typeof ed25519.sign>[0],
    secretKey: Ed25519SecretKey,
) => ed25519.sign(message, secretKey.slice(0, 32));

export const verify = ed25519.verify;

export class PlainWallet implements Wallet {
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
        this.identifier = PlainWallet.normalize_identifier(identifier);
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