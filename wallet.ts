import path from 'path';

import { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

import { log } from "./logging";
import { ensureDirExists, ensureAtLeastOneWalletExists, readKeypairFromfile } from "./file_utils";

interface Configuration {
    DATA_DIR: string,
    SOLANA_WALLET: string,
}
const CONFIGURATION: Configuration = extractConfigsFromParameters()
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

async function New(): Promise<void> {
    ensureDirExists(CONFIGURATION.DATA_DIR);
    ensureAtLeastOneWalletExists(CONFIGURATION.SOLANA_WALLET, createKeyPair).catch((error: Error) => console.error(error));

    let keypair: Keypair = await readKeypairFromfile(CONFIGURATION.SOLANA_WALLET);
    log("keypair : ", keypair)
}

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

log(CONFIGURATION)