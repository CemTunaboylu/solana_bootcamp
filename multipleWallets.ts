import { Connection, SystemProgram, Transaction, BlockhashWithExpiryBlockHeight, PublicKey, TransactionSignature, SignatureResult, VersionedTransaction } from '@solana/web3.js';

import { logWithTrace } from "./logging";
import { Wallet, TransactionConfirmer, BalanceChecker, IdentifiedBalanceMap, WalletVaultDelResult } from './interfaces';
import { TransactionOrError, prepareTransaction, transfer, createSignatures, createVersionedTransactionFrom, transferTransaction, UnsignedTransaction } from "./walletFunctionality";
import { recoverNested } from '@solana/spl-token';


import { ensureDirExists, readKeypairFromfile, listFilesInDirectory, extractFileName } from './fileUtilities';
import { readFileSync } from 'fs';
import { TaggedConcurrentWalletVault } from './wallet_vault';
import { PlainWallet } from './plainWallet';
import { WithIdentifier, WithKeypair } from './walletCustomizers';

async function New(walletsDirectory: string = "./wallets", withCapacity?: number): Promise<WalletVault> {
    await ensureDirExists(walletsDirectory);
    const files = await listFilesInDirectory(walletsDirectory)

    const readPromises = files.map(file => readKeypairFromfile(file))
    const keyPairs = await Promise.all(readPromises);
    const taggedConcurrentWalletVault = new TaggedConcurrentWalletVault(withCapacity);
    keyPairs.forEach((keyPair: Keypair, index: number) => {
        const wallet = new PlainWallet(WithIdentifier(files[index]), WithKeypair(keyPair));
        taggedConcurrentWalletVault.set(wallet);
    })
    return taggedConcurrentWalletVault;
}

/* handles many-to-many or many-to-one relationships with source and target wallets, multiple elements are assumed to be of same length 
     one can have the following:
    All combinations of the following:
     - Many/one source wallets to many/one target wallet with many/one lamports  
    Examples:
     - Many source wallets to many target wallets with many lamports (they all are assumed to be of same length) 
     - Many source wallets to many target wallets with same amount of lamports L (source and target are assumed to be of same length) where 
        each source sends L lamports to target
    note that they are grouped according to their indices.
*/

type TransactionMapping = {
    wallet?: Wallet,
    lamport?: number,
    publickey?: PublicKey
}

type AsyncTransactionMappingGenerator = () => AsyncGenerator<TransactionMapping, void, unknown> // <parameters, returnType, next>
type TypeKey = "wallet" | "publickey" | "number"

function typeToTypeKeyValue(obj: any): TypeKey {
    if (obj instanceof PublicKey) return "publickey" as TypeKey;
    let typeString: string = typeof obj
    if ("object" === typeString && "getIdentifier" in obj)
        typeString = "wallet"
    return typeString as TypeKey
}

type Assigner = (ix: number, txMapping: TransactionMapping) => void;

export async function* dynamicMappingGenerator(tobeMappedInOrder: [Wallet[], number[], PublicKey[]]): AsyncGenerator<TransactionMapping, void, unknown> {
    const logTrace = "dynamicMappingGenerator";
    let wnpAssignments: Assigner[] = []
    const lengths = tobeMappedInOrder.map(e => e.length).filter(l => l > 1);
    let shortestLength = lengths ? Math.min(...lengths) : 1; // 1 for the case where each one has length 1

    for (let index = 0; index < tobeMappedInOrder.length; index++) {
        const element = tobeMappedInOrder[index];
        if (undefined == element) continue; // should not happen
        let toPush;
        toPush = (ix: number, txMapping: TransactionMapping) => {
            switch (typeof element[0]) {
                case "number":
                    txMapping.lamport = (element.length == 1 ? element[0] : element[ix]) as number
                    break;
                default:
                    if (element[0] instanceof PublicKey)
                        txMapping.publickey = (element.length == 1 ? element[0] : element[ix]) as PublicKey
                    else
                        txMapping.wallet = (element.length == 1 ? element[0] : element[ix]) as Wallet
                    break;
            }
        }
        wnpAssignments.push(toPush);
    }

    for (let index = 0; index < shortestLength; index++) {
        let transactionMapping: TransactionMapping = {}
        for (let entity = 0; entity < tobeMappedInOrder.length; entity++) {
            wnpAssignments[entity](index, transactionMapping);
        }
        yield transactionMapping;
    }
}

// TODO: add strategies for matching many wallets can send the same amount of lamports to that many wallets, or one wallet (3 strategies) 
function divideIntoEnoughAndLackingBalancedWallets(identifiedBalanceMap: IdentifiedBalanceMap, wallets: Wallet[], lamports: number[]): [Wallet[], Wallet[]] {
    let enough: Wallet[] = new Array<Wallet>();
    let lacking: Wallet[] = new Array<Wallet>();

    // assume that if they are not of same length, the parts that are matching are correct
    const shortestLength = wallets.length < lamports.length ? wallets.length : lamports.length;


    for (let index = 0; index < shortestLength; index++) {
        const wallet = wallets[index];
        const identifier = wallet.getIdentifier();

        if (!identifiedBalanceMap.has(identifier)) {
            // assume that if its balance cannot be retrieved, it does not have enough balance
            lacking.push(wallet);
            continue;
        }
        const balance = identifiedBalanceMap.get(identifier);
        if (balance && balance > lamports[index]) enough.push(wallet)
        else lacking.push(wallet)
    }
    return [enough, lacking]

}
// TODO: have strategies, many to one, one to one: X wallets to X wallet, X wallets to 1 wallet
export async function prepareTransactions(
    fromWallets: Array<Wallet>,
    toPublicKeys: Array<PublicKey>,
    lamports: Array<number>,
    recentBlockHash: BlockhashWithExpiryBlockHeight,
    balanceChecker?: BalanceChecker,
): Promise<Array<TransactionOrError>> {
    let toBeProcessedWallets = fromWallets;
    if (balanceChecker) {
        const identifiedBalanceMap: IdentifiedBalanceMap = await balanceChecker.getBalances(...fromWallets);
        const enoughAndLackingWallets = divideIntoEnoughAndLackingBalancedWallets(identifiedBalanceMap, fromWallets, lamports);
        toBeProcessedWallets = enoughAndLackingWallets[0]
    }
    // assume that if they are not of same length, the parts that are matching are correct
    const shortestLength = Math.min(fromWallets.length, toPublicKeys.length, lamports.length);
    let txOrErrs = new Array<TransactionOrError>(shortestLength);

    for (let index = 0; index < shortestLength; index++) {
        const wallet = toBeProcessedWallets[index];
        const txOrError = await prepareTransaction(wallet, toPublicKeys[index], lamports[index], recentBlockHash)
        let toPut;
        if (txOrError.isTransactionFormationFailed()) {
            const errMessage = `Could not form transaction for wallet ${wallet.getIdentifier()} to send to ${toPublicKeys[index]}, error: ${txOrError.err}`
            toPut = new TransactionOrError(null, new Error(errMessage))
        } else {
            toPut = new TransactionOrError(txOrError.getTransaction(), null)
        }
        txOrErrs[index] = toPut;
    }
    return txOrErrs

}
// TODO: add preTransfer and postTransfer
export async function multiTransfer(
    connection: Connection,
    fromWallets: Wallet[],
    lamports: number[],
    ...toPublicKeys: PublicKey[]): Promise<TransactionSignature[]> {
    const logTrace = 'Transfer'
    let txSignature: TransactionSignature = "";
    try {
        const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash()
        // TODO: inject function to get where to transfer
        // const function to() {}
        const txOrErrors: TransactionOrError[] = await Promise.all(
            fromWallets.map(
                (from, index) => {
                    const amountInLamports = lamports[index];
                    const toPublicKey = toPublicKeys[index];
                    return prepareTransaction(from, toPublicKey, amountInLamports, recentBlockHash)
                }
            )
        )
        const validTransactions = txOrErrors
            .filter(txOrError => !txOrError.isTransactionFormationFailed() && null != txOrError.getTransaction()).map(tx => tx.getTransaction())
        // validTransactions can only be of type Transaction or 
        return transferTransactions(connection, validTransactions)
    } catch (error) {
        return Promise.resolve(new Array<string>())
    }
}


// TODO: add preTransfer and postTransfer
export async function transferTransactions(
    connection: Connection,
    transactions: Array<VersionedTransaction | UnsignedTransaction>,
): Promise<TransactionSignature[]> {
    const logTrace = 'Transfer'
    const recentBlockHash: BlockhashWithExpiryBlockHeight = await connection.getLatestBlockhash()
    return Promise.all(
        transactions.map(async element => {
            try {
                const signature = transferTransaction(connection, element);
                return signature;
            }
            catch (error) {
                logWithTrace(logTrace, error)
                return `${error}`;
            }
        })
    )
}

export async function airdrop(connection: Connection, toWallet: Wallet, lamports: number, confirmer?: TransactionConfirmer) {
    const logTrace = 'airdrop'
    const airdropSignature = await connection.requestAirdrop(
        toWallet.getPublicKey(),
        lamports
    )
    if (confirmer) {
        const signatureResult: SignatureResult = await confirmer.confirm(airdropSignature);
        const hasError = signatureResult.err != null
        logWithTrace(logTrace, `confirmation is ${["successful", "failed"][+(hasError)]} `)
    }
}