import { Keypair, PublicKey, Transaction, Connection } from "@solana/web3.js";
import { ed25519 } from '@noble/curves/ed25519';

import { Wallet, WalletCustomizerFunction, Ed25519SecretKey } from './interfaces';
import { writeKeyPairToFile, readKeypairFromfile, extractFileName } from "./fileUtilities";
import { WithIdentifier, WithKeypair } from "./walletCustomizers";


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

    async loadFrom(filePath: string): Wallet {
        const keypair = await readKeypairFromfile(filePath);
        const identifier = extractFileName(filePath);
        return new PlainWallet(WithIdentifier(identifier), WithKeypair(keypair))
    }

    async dump(dirPath: string) {
        const keypair = this.keypair;
        const identifier = this.getIdentifier()
        await writeKeyPairToFile(`${dirPath}/${identifier}.json`, keypair)
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