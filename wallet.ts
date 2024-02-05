import path from 'path';

import { Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, Keypair, PublicKey, TransactionSignature, sendAndConfirmTransaction } from "@solana/web3.js";

import { log } from "./logging";
import { ensureDirExists, ensureAtLeastOneWalletExists, readKeypairFromfile } from "./file_utils";

interface Configuration {
    DATA_DIR: string,
    SOLANA_WALLET: string,
}
const CONFIGURATION: Configuration = extractConfigsFromParameters()

interface Wallet {
    keypair: Keypair
}

let UserWallet: Wallet;

const LOCALHOST = "http://127.0.0.1:8899"

// const connection = new Connection(clusterApiUrl("testnet", false));
const connection = new Connection(LOCALHOST, "confirmed");

function extractConfigsFromParameters(): Configuration {
    var argv = require('minimist')(process.argv.slice(2));
    const walletFile = argv['wallet_file'] || "wallet.json";
    const data_dir = argv['data_dir'] || "data";
    return {
        DATA_DIR: data_dir,
        SOLANA_WALLET: path.join(data_dir, walletFile),
    }
}

/*
    TODOs: 
        1. Verbosity level for logs
        2. use timeouts in asyncs
        3. guard the secret key
        4. solve bigint problem
*/


function createKeyPair(): Keypair {
    return Keypair.generate();
}

async function New(): Promise<Keypair> {
    ensureDirExists(CONFIGURATION.DATA_DIR);
    await ensureAtLeastOneWalletExists(CONFIGURATION.SOLANA_WALLET, createKeyPair).catch((error: Error) => console.error(error));

    let keypair: Keypair = await readKeypairFromfile(CONFIGURATION.SOLANA_WALLET);
    UserWallet = { keypair: keypair }
    return keypair
}


async function Transer(toPublicKey: PublicKey, amount: number) {
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: UserWallet.keypair.publicKey,
            toPubkey: toPublicKey,
            lamports: amount,
        })
    )
    let signature: TransactionSignature = await sendAndConfirmTransaction(connection, transaction, [UserWallet.keypair]);
    log(signature)
}


async function airdrop(amount: number) {
    const airdropSignature = await connection.requestAirdrop(
        UserWallet.keypair.publicKey,
        amount
    );
    await connection.confirmTransaction(airdropSignature);
}

async function balance() {
    let balance: number = await connection.getBalance(UserWallet.keypair.publicKey);
    log("current balance: ", balance)
}


async function test() {
    let dummy: Keypair = createKeyPair()
    await New();
    await airdrop(10)

    const airdropSignature = await connection.requestAirdrop(
        dummy.publicKey,
        10
    );
    await balance()
    Transer(dummy.publicKey, 2);
}
test()