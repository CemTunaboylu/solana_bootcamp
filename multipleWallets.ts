import {
    Connection,
    BlockhashWithExpiryBlockHeight,
    PublicKey,
    TransactionSignature,
    SignatureResult,
    VersionedTransaction,
    Keypair
} from '@solana/web3.js';

import { logWithTrace } from "./logging";
import {
    Wallet,
    TransactionConfirmer,
    BalanceChecker,
    IdentifiedBalanceMap,
    WalletVault,
} from './interfaces';

import {
    TransactionOrError,
    prepareTransaction,
    transferTransaction,
    UnsignedTransaction
} from "./walletFunctionality";

import { ensureDirExists, readKeypairFromfile, listFilesInDirectory, extractFileName } from './fileUtilities';
import { readFileSync } from 'fs';
import { TaggedConcurrentWalletVault } from './wallet_vault';
import { PlainWallet } from './plainWallet';
import { WithIdentifier, WithKeypair } from './walletCustomizers';
import { createInitializeDefaultAccountStateInstruction } from '@solana/spl-token';

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

type AsyncTransactionMappingGenerator = (tobeMappedInOrder: TransactionTripletArray) => AsyncGenerator<TransactionMapping, void, unknown> // <parameters, returnType, next>
type TypeKey = "wallet" | "publickey" | "number"

function typeToTypeKeyValue(obj: any): TypeKey {
    if (obj instanceof PublicKey) return "publickey" as TypeKey;
    let typeString: string = typeof obj
    if ("object" === typeString && "getIdentifier" in obj)
        typeString = "wallet"
    return typeString as TypeKey
}

type Assigner = (ix: number, txMapping: TransactionMapping) => void;

type TransactionTripletArray = [Wallet[], number[], PublicKey[]]

export async function* dynamicMappingGenerator(tobeMappedInOrder: TransactionTripletArray): AsyncGenerator<TransactionMapping, void, unknown> {
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

async function divideIntoEnoughAndLackingBalancedWallets(
    identifiedBalanceMap: IdentifiedBalanceMap,
    wallets: Wallet[],
    lamports: number[],
    publicKeys: PublicKey[],
): Promise<TransactionTripletArray[]> {

    // let toProcessTriplets = [[] as Wallet[], [] as number[], [] as PublicKey[]];
    let toProcessTriplets: TransactionTripletArray = [[], [], []]
    let lackingTriplets: TransactionTripletArray = [[], [], []]


    for await (const { wallet, lamport, publickey } of dynamicMappingGenerator([wallets, lamports, publicKeys])) {
        const identifier = (wallet as Wallet).getIdentifier();

        const balance = identifiedBalanceMap.get(identifier);
        const undefinedProperty = (undefined == balance || undefined == lamport)
        if (undefinedProperty || balance <= lamport) {
            lackingTriplets[0].push(wallet as Wallet);
            lackingTriplets[1].push(lamport as number);
            lackingTriplets[2].push(publickey as PublicKey);
            continue;
        }
        toProcessTriplets[0].push(wallet as Wallet);
        toProcessTriplets[1].push(lamport as number);
        toProcessTriplets[2].push(publickey as PublicKey);
    }

    return [toProcessTriplets, toProcessTriplets];

}
// TODO: have strategies, many to one, one to one: X wallets to X wallet, X wallets to 1 wallet etc.
export async function prepareTransactions(
    fromWallets: Array<Wallet>,
    toPublicKeys: Array<PublicKey>,
    lamports: Array<number>,
    recentBlockHash: BlockhashWithExpiryBlockHeight,
    transactionMappingGenerator: AsyncTransactionMappingGenerator,
    balanceChecker?: BalanceChecker,
): Promise<Array<TransactionOrError>> {
    const logTrace = "prepareTransactions"
    let toBeProcessedTriplets: TransactionTripletArray;
    if (balanceChecker) {
        const identifiedBalanceMap: IdentifiedBalanceMap = await balanceChecker.getBalances(...fromWallets);
        const enoughAndLackingTriplets = await divideIntoEnoughAndLackingBalancedWallets(identifiedBalanceMap, fromWallets, lamports, toPublicKeys);
        toBeProcessedTriplets = enoughAndLackingTriplets[0];
        if (enoughAndLackingTriplets[1].length > 0)
            logWithTrace(logTrace, `there are discarded prospective transfers due unsufficient balance: ${enoughAndLackingTriplets[1]}`)
    } else {
        toBeProcessedTriplets = [fromWallets, lamports, toPublicKeys]
    }
    // use this : let toBeProcessedWallets = fromWallets;
    const promisesForTransactionsOrErrors = [];
    for await (const { wallet, lamport, publickey } of dynamicMappingGenerator(toBeProcessedTriplets)) {
        const txOrErrorPromise = prepareTransaction(wallet as Wallet, publickey as PublicKey, lamport as number, recentBlockHash);
        promisesForTransactionsOrErrors.push(txOrErrorPromise);
    }

    return await Promise.all(promisesForTransactionsOrErrors);
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