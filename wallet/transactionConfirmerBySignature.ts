import { Connection, TransactionSignature, SignatureResult } from "@solana/web3.js";

import { TransactionConfirmer } from './interfaces';
import { logWithTrace } from './logging';


export class TransactionConfirmerBySignature implements TransactionConfirmer {
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