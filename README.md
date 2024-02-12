TODOs: 
    - record the keys
    - Merge accounts to gather necessary lamports if one does not have enough
    - give tags to wallets, control wallets through them too -> send from all #<some_tag> to 
    - transactions with time -> for future date
    - subscription


## Later
    3. guard the secret key
    6. Password protect
    7. Interactive mode
    2. use timeouts in asyncs
    11. With retries

    type SendOptions = {
        /** disable transaction verification step */
        skipPreflight?: boolean;
        /** preflight commitment level */
        preflightCommitment?: Commitment;
        /** Maximum number of times for the RPC node to retry sending the transaction to the leader. */
        maxRetries?: number;
        /** The minimum slot that the request can be evaluated at */
        minContextSlot?: number;
    };
    /**
     * Options for confirming transactions
     */
    type ConfirmOptions = {
        /** disable transaction verification step */
        skipPreflight?: boolean;
        /** desired commitment level */
        commitment?: Commitment;
        /** preflight commitment level */
        preflightCommitment?: Commitment;
        /** Maximum number of times for the RPC node to retry sending the transaction to the leader. */
        maxRetries?: number;
        /** The minimum slot that the request can be evaluated at */
        minContextSlot?: number;
    };