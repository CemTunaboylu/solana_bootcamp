import { Keypair, PublicKey } from '@solana/web3.js';

import { WalletCustomizerFunction, Wallet } from './interfaces'
import { writeKeyPairToFile } from './file_utils'

export function WithIdentifier(identifier: string): WalletCustomizerFunction {
    return (wallet: Wallet) => {
        wallet.identifier = identifier
    }
}

export function WithKeypair(keypair: Keypair): WalletCustomizerFunction {
    return (wallet: Wallet) => {
        if (wallet.identifier !== null) {
            throw new Error('Cannot set keypairs of a wallet without identifier')
        }
        wallet.publicKey = keypair.publicKey;
        const privateKeyFile = `${wallet.identifier}.json`;
        writeKeyPairToFile(privateKeyFile, keypair).then(
            () => wallet.privateKeyFile = privateKeyFile
        );
    }
}

export function WithPublicKey(publicKey: PublicKey): WalletCustomizerFunction {
    return (wallet: Wallet) => {
        wallet.publicKey = publicKey
    }
}

// will always be overwritten by real balance once it is fetched, mostly for 
export function WithBalance(lamports: number): WalletCustomizerFunction {
    return (wallet: Wallet) => {
        wallet.balance = lamports
    }
}