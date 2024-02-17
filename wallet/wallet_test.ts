import { Connection, TransactionSignature, LAMPORTS_PER_SOL, BlockhashWithExpiryBlockHeight, VersionedTransaction } from "@solana/web3.js";

import { Wallet, BalanceChecker, IdentifiedBalanceMap } from './interfaces';
import { UnsignedTransaction, airdrop, createVersionedTransactionFrom, prepareTransaction, transfer } from "./walletFunctionality"
import { ConnectionManager, ConnectionType } from './connection';
import { logWithTrace } from './logging';
import { PlainWallet } from "./plainWallet";
import { TransactionConfirmerBySignature } from "./transactionConfirmerBySignature"

function isPassed(booleanChecks: boolean): string {
    return ["failed", "successful"][+(booleanChecks)]
}

class MockBalanceController implements BalanceChecker {
    toReturn: number | null; // in lamports
    toReturnMap: IdentifiedBalanceMap = new Map<string, number>; // in lamports

    constructor(n: number | null, nMap?: IdentifiedBalanceMap) {
        this.toReturn = n
        if (nMap)
            this.toReturnMap = nMap
    }
    updateBalances(...wallets: Wallet[]): void {
        return;
    }
    getBalance(wallet: Wallet): Promise<number | null> {
        return Promise.resolve(this.toReturn);
    }
    getBalances(...wallets: Wallet[]): Promise<IdentifiedBalanceMap> {
        return Promise.resolve(this.toReturnMap);
    }
    doesHaveEnoughBalance(wallet: Wallet, forAmountInLamports: number): Promise<boolean> {
        const isBalanceNotNull = null != this.toReturn;
        const isBalanceBigger = this.toReturn as number > forAmountInLamports;
        return Promise.resolve(isBalanceNotNull && isBalanceBigger);
    }
}

type TestController = {
    testConnectionManager: ConnectionManager,
    sourceWallet: PlainWallet,
    targetWallet: PlainWallet,
}

function createTestController(): TestController {
    return {
        testConnectionManager: new ConnectionManager(),
        sourceWallet: new PlainWallet(),
        targetWallet: new PlainWallet(),
    }
}


async function test_airdrop(conn: Connection, wallet: Wallet, solAmount: number = 5) {
    let confirmer = new TransactionConfirmerBySignature(conn, "airdrop-confirmer");
    await airdrop(conn, wallet, solAmount * LAMPORTS_PER_SOL, confirmer);
}

async function test_prepareTransaction(conn: Connection, sourceTestWallet: PlainWallet, targetWallet: Wallet) {
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


    for (let testCase of testCases) {
        let mockBalanceChecker = new MockBalanceController(testCase.sourceBalance);
        const sourceWallet = sourceTestWallet as Wallet;
        let testResultMsg: string = "succesful-test", passed = true; // assume all will be good :) 
        const txOrError = await prepareTransaction(
            sourceWallet,
            targetWallet.getPublicKey(),
            testCase.lamportsToSend,
            recentBlockHash,
            mockBalanceChecker);

        if (null != txOrError.err || null == txOrError.tx) {
            passed = testCase.expectsError;
            testResultMsg = [
                `UNEXPECTED ERROR OCCURED: ${txOrError.err}`,
                `got the expected error`
            ][+passed]
        } else {
            let tx = txOrError.getTransaction();
            let msg;
            if (null != tx && tx instanceof UnsignedTransaction) {
                const bareTx = tx.tx;
                msg = bareTx.compileMessage();
                tx = createVersionedTransactionFrom(tx.wallet, bareTx)
                passed = passed && (msg.accountKeys[0].equals(sourceTestWallet.getPublicKey()))
                passed = passed && (msg.accountKeys[1].equals(targetWallet.getPublicKey()))
            } else if (tx instanceof VersionedTransaction) {
                msg = tx.message;
                const accKeys = msg.getAccountKeys();
                const source = accKeys.get(0);
                const to = accKeys.get(1);
                passed = passed && (undefined != source && source.equals(sourceTestWallet.getPublicKey()))
                passed = passed && (undefined != to && to.equals(targetWallet.getPublicKey()))
            }
            passed = passed && (txOrError.isTransactionFormationFailed() == (testCase.expectsError));
            if (msg)
                passed = passed && (msg.recentBlockhash === recentBlockHash.blockhash)
            if (!passed) {
                testResultMsg = `compiled message: ${JSON.stringify(msg)}`
            }
        }
        logWithTrace(scopeTrace + testCase.testName, `${testResultMsg} : ${isPassed(passed)}`)
    }
}


async function test_transfer(conn: Connection, sourceTestWallet: PlainWallet, targetWallet: Wallet) {
    const scopeTrace = "test_transfer"
    const sourceBalanceInLamports: number = 1000 * LAMPORTS_PER_SOL;
    let lamportsToSend: number = 1 * LAMPORTS_PER_SOL;

    let mockBalanceChecker = new MockBalanceController(sourceBalanceInLamports);
    const sourceWallet = sourceTestWallet as Wallet;

    const txSignature: TransactionSignature = await transfer(conn, sourceWallet, lamportsToSend, targetWallet.getPublicKey(), mockBalanceChecker);
    const passed = "" !== txSignature;
    const testResult = `transaction signature is ${txSignature}, test is ${isPassed(passed)}`
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

