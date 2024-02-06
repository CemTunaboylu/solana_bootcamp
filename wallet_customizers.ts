import { Keypair, PublicKey } from '@solana/web3.js';

import { WalletCustomizerFunction, Wallet } from './interfaces'
import { writeKeyPairToFile } from './file_utils'

export function WithIdentifier(identifier: string): WalletCustomizerFunction {
    return (wallet: Wallet) => {
        wallet.setIdentifier(identifier)
    }
}

export function WithKeypair(keypair: Keypair): WalletCustomizerFunction {
    return (wallet: Wallet) => {
        if (wallet.getIdentifier() !== null) {
            throw new Error('Cannot set keypairs of a wallet without identifier')
        }
        // setting the private key automatically updates the public key
        wallet.setPrivateKey(keypair.secretKey);
    }
}