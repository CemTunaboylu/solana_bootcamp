import { Connection, TransactionSignature, SignatureResult, LAMPORTS_PER_SOL, BlockhashWithExpiryBlockHeight } from "@solana/web3.js";

import { Wallet, TransactionConfirmer } from './interfaces';
import { airdrop, prepareTransaction, transfer } from "./wallet"
import { ConnectionManager, ConnectionType } from './connection';
import { logWithTrace } from './logging';
import { TestWallet } from "./wallet_impl";

class TransactionConfirmerBySignature implements TransactionConfirmer {
    connection: Connection;
    logTrace: string;

    constructor(connection: Connection, logTrace: string) {
        this.connection = connection;
        this.logTrace = logTrace;
    }

    async confirm(txSignature: TransactionSignature): Promise<SignatureResult> {
        // TODO: fix with removing deprecated confirmation
        let responseAndContext = await this.connection.confirmTransaction(txSignature, 'finalized');
        logWithTrace(this.logTrace, `confirmed ${txSignature} is in slot ${responseAndContext.context.slot}`)
        return responseAndContext.value
    }
}

type TestController = {
    testConnectionManager: ConnectionManager,
    sourceWallet: TestWallet,
    targetWallet: TestWallet,
}

function createTestController(): TestController {
    return {
        testConnectionManager: new ConnectionManager(),
        sourceWallet: new TestWallet(),
        targetWallet: new TestWallet(),
    }
}


async function test_airdrop(conn: Connection, wallet: Wallet, solAmount: number = 5) {
    let confirmer = new TransactionConfirmerBySignature(conn, "airdrop-confirmer");
    await airdrop(conn, wallet, solAmount * LAMPORTS_PER_SOL, confirmer);
}

async function test_prepareTransaction(conn: Connection, sourceTestWallet: TestWallet, targetWallet: Wallet) {
    const recentBlockHash: BlockhashWithExpiryBlockHeight = await conn.getLatestBlockhash()
    type TestCase = { testName: string, sourceBalance: number, lamportsToSend: number, expectsError: boolean };
    const scopeTrace = "test_prepareTransaction"
    let testCases: TestCase[] = [
        {
            testName: "fails due to insufficient balance",
            sourceBalance: 100,
            lamportsToSend: 1000,
            expectsError: true
        },
        {
            testName: "fails due to insufficient fee",
            sourceBalance: 1000,
            lamportsToSend: 1000,
            expectsError: true
        },
        {
            testName: "successful transaction",
            sourceBalance: 1000,
            lamportsToSend: 100,
            expectsError: false
        }
    ]

    const balance = await sourceTestWallet.getBalance()

    for (let testCase of testCases) {
        sourceTestWallet.balance = testCase.sourceBalance;
        const sourceWallet = sourceTestWallet as Wallet;
        let testResultMsg: string = "succesful-test";
        let passed = true;
        const txOrError = await prepareTransaction(sourceWallet, targetWallet.getPublicKey(), testCase.lamportsToSend, recentBlockHash, true);
        if (null != txOrError.err || null == txOrError.tx) {
            passed = testCase.expectsError;
            testResultMsg = [
                `FAILED - UNEXPECTED ERROR OCCURED, test is failed: ${txOrError.err}`,
                `got the expected error`
            ][+passed]
        } else {
            const compiledMessage = txOrError.tx.compileMessage();
            passed = passed && (compiledMessage.recentBlockhash === recentBlockHash.blockhash)
            passed = passed && (compiledMessage.accountKeys[0].equals(sourceTestWallet.getPublicKey()))
            passed = passed && (compiledMessage.accountKeys[1].equals(targetWallet.getPublicKey()))
            passed = passed && false == (testCase.expectsError);
            if (!passed) {
                testResultMsg = `compiled message: ${JSON.stringify(compiledMessage)}`
            }
        }
        logWithTrace(scopeTrace + testCase.testName, `${testResultMsg} : ${["failed", "successful"][+(passed)]}`)
    }

    sourceTestWallet.balance = balance;
}

async function test_transfer(conn: Connection, sourceTestWallet: TestWallet, targetWallet: Wallet) {
    const scopeTrace = "test_transfer"
    const balance: number = 1000;
    let lamportsToSend: number = 1 * LAMPORTS_PER_SOL;

    sourceTestWallet.balance = balance
    const sourceWallet = sourceTestWallet as Wallet;

    const txSignature = await transfer(conn, sourceWallet, targetWallet.getPublicKey(), lamportsToSend);
    const empty = "" === txSignature
    const testResult = `transaction signature is ${txSignature}, test is ${["successful", "failed"][+(empty)]}`
    logWithTrace(scopeTrace, testResult)

}

// TODO: get all the functions with test in their names with reflection and run them one by one
async function test() {
    let testController = createTestController()
    // make it prepare the connection first
    const localhostConnection = testController.testConnectionManager.get(ConnectionType.LOCALHOST)
    await test_airdrop(localhostConnection, testController.sourceWallet, 100)
    test_prepareTransaction(localhostConnection, testController.sourceWallet, testController.targetWallet)
    test_transfer(localhostConnection, testController.sourceWallet, testController.targetWallet)
}

test()

