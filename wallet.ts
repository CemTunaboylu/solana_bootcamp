import path from 'path';

import { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { log } from "./logging";
import { ensureDirExists, ensureAtLeastOneWalletExists, readKeypairFromfile } from "./file_utils";

interface Configuration {
    DATA_DIR: string,
    SOLANA_WALLET: string,
}
const CONFIGURATION: Configuration = extractConfigsFromParameters()

function extractConfigsFromParameters(): Configuration {
    var argv = require('minimist')(process.argv.slice(2));
    log(argv);
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
    await ensureDirExists(CONFIGURATION.DATA_DIR);
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


log(CONFIGURATION)