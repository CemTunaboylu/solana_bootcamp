import path from 'path';

import { log } from "./logging";
import {
    ensureDirExists,
    ensureAtLeastOneWalletExists,
    readKeypairFromfile
} from "./file_utils";

interface Configuration {
    DataDir: string,
    MultiWallet: boolean,
    Interactive: boolean,
}
const CONFIGURATION: Configuration = extractConfigsFromParameters()

function extractConfigsFromParameters(): Configuration {
    var argv = require('minimist')(process.argv.slice(2));
    return {
        DataDir: argv['data_dir'] || "data", // where to put everything :) 
        MultiWallet: argv['multi-wallet'] || false, // enables multiwallet control with unique string identifiers
        Interactive: argv['interactive'] || false, // interactive mode allows multiple operations and more control 
    }
}

function setupFileSystem() {
    ensureDirExists(CONFIGURATION.DataDir);
}

setupFileSystem()
