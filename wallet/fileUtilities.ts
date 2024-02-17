import { promises as fs } from 'fs';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { log } from './logging';

import { Keypair } from "@solana/web3.js";

export function ensureDirExists(dirPath: string): void {
    if (!existsSync(dirPath)) {
        log(`Directory ${dirPath} does not exist, creating...`);
        mkdirSync(dirPath, { recursive: true });
        log(`Directory ${dirPath} created successfully.`);
    } else {
        log('Directory already exists.');
    }
}

export async function listFilesInDirectory(directory: string = "./"): Promise<string[]> {
    const dirPath = resolve(directory);
    let files: string[] = []
    try {
        files = await fs.readdir(dirPath);
    } catch (error) {
    }
    return files;
}

export async function ensureAtLeastOneWalletExists(filePath: string, keyCreationFunction: () => Keypair): Promise<void> {
    const fullPath = resolve(filePath);
    try {
        await fs.access(fullPath); // Check if the file exists
        log('Found the existing wallet.');
    } catch (error) { // If the file does not exist, create it with the key pair 
        let keyPair = keyCreationFunction();
        log("Wallet cannot be found, generating...");
        await writeKeyPairToFile(fullPath, keyPair);
        log('Wallet created and saved successfully.');
    }
}

export async function writeKeyPairToFile(filePath: string, keyPair: Keypair) {
    const fullPath = resolve(filePath);
    await fs.writeFile(fullPath, JSON.stringify(Array.from(keyPair.secretKey)));
    log('Keypair written successfully.');
}

export async function readKeypairFromfile(filePath: string, encoding: string = "utf8"): Promise<Keypair> {
    let retrievedKeypair: string = readFileSync(filePath, encoding);
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(retrievedKeypair)));
}

export function extractFileName(filePath: string): string {
    let fileName = filePath;
    const slashIndex = filePath.lastIndexOf("/");
    if (undefined == slashIndex) {
        fileName = filePath.substring(slashIndex);
    }

    const pointIndex = fileName.lastIndexOf(".");
    if (undefined == pointIndex) {
        fileName = filePath.substring(pointIndex);
    }
    return fileName;
}