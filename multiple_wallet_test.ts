import { dynamicMappingGenerator } from "./multipleWallets";
import { PlainWallet } from "./plainWallet"
import { Wallet } from "./interfaces";
import { logWithTrace } from "./logging";
import { Keypair, PublicKey } from "@solana/web3.js";
import { WithIdentifier } from "./walletCustomizers";

function isPassed(booleanChecks: boolean): string {
    return ["failed", "successful"][+(booleanChecks)]
}

// to try a lot of multiple elements, this can be used to be more efficient
function* bitPermutations(len: number): Generator<number, void, unknown> {
    const numOfBits = 1 << len
    for (let index = 0; index < numOfBits; index++) {
        yield index
    }
}

async function test_generator() {
    const logTrace = "generator-test-";

    const manyLength = 5, length = 3;
    const identifierPrefix = "test-"

    const numOfBits = (1 << length - 1)
    // 000 -> 111 where 1 is the element is multiple i.e. multiple wallets, 0 is single i.e. one wallet.
    for (let permInBits = 0; permInBits < numOfBits; permInBits++) {
        let triplet = [];
        let creator;
        for (let index = 0; index < length; index++) {
            switch (index) {
                case 0: // wallet
                    creator = (c: number) => { return new PlainWallet(WithIdentifier(identifierPrefix + c)) }
                    break;
                case 1: // lamports
                    creator = (c: number) => { return permInBits } // will always be between [0,2^length)
                    break;
                case 2: // publickey 
                    creator = (c: number) => { return Keypair.generate().publicKey }
                    break;
                default:
                    break;
            }
            if (undefined == creator) continue;
            // does this index (Wallet, lamports or PublicKey) has a set bit i.e. has multiple elements in its list
            const multiple = (permInBits & (1 << index)) > 0
            let list = [creator(0)]
            for (let counter = 1; counter < manyLength; counter++) {
                list.push(creator(counter))
            }
            triplet.push(list)
        }
        let counter = 0;
        for await (const { wallet, lamport, publickey } of dynamicMappingGenerator(triplet as [Wallet[], number[], PublicKey[]])) {
            let passed = (undefined != wallet && wallet.getIdentifier().startsWith(identifierPrefix));
            passed = passed && (undefined != lamport && permInBits == lamport);
            logWithTrace(logTrace + counter, ":" + isPassed(passed))
            counter += 1
            if (!passed) {
                console.log("wallet:", wallet)
                console.log("lamport:", lamport)
                console.log("publickey:", publickey)
            }
            counter += 1;
        }
    }
}


async function main() {
    await test_generator()
}
main()