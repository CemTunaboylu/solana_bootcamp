import {
    Wallet,
    WalletVault,
    TaggedRetriever,
    WalletVaultSetResult,
    WalletVaultDelResult,
    TaggingResult
} from "./interfaces";

export class TaggedConcurrentWalletVault implements TaggedRetriever, WalletVault {
    wallets: Array<Wallet>;
    identifierToWalletsMap: Map<string, number>;
    tagToWalletsMap: Map<string, Array<number>>;
    _capacity?: number

    constructor(capacity: number = 10) {
        this._capacity = capacity
        this.wallets = new Array<Wallet>(capacity);
        this.identifierToWalletsMap = new Map();
        this.tagToWalletsMap = new Map();
    }

    static normalize_tag(tag: string): string {
        return tag.trim().normalize().toLowerCase();
    }

    // methods for WalletVault
    get(identifier: string): Wallet | null {
        if (!this.identifierToWalletsMap.has(identifier)) {
            return null;
        }
        const index: number = this.identifierToWalletsMap.get(identifier);
        return this.wallets[index];
    }

    set(identifier: string, wallet: Wallet): WalletVaultSetResult {

        if ("" == identifier)
            return WalletVaultSetResult.InvalidIdentifier;

        if (this.identifierToWalletsMap.has(identifier))
            return WalletVaultSetResult.WalletWithIdentifierAlreadyExists;

        if (this._capacity == this.wallets.length)
            return WalletVaultSetResult.Failed;

        this.wallets.push(wallet)
        const index = this.wallets.length;
        this.identifierToWalletsMap.set(identifier, index)
        return WalletVaultSetResult.Successful;
    }

    _deleteWalletAt(index: number) {
        const len = this.wallets.length;
        const last: Wallet = this.wallets[len - 1]
        this.wallets[index] = last
        this.wallets.pop()
    }
    del(identifier: string, wallet: Wallet): WalletVaultDelResult {

        if ("" == identifier)
            return WalletVaultDelResult.InvalidIdentifier;

        if (!this.identifierToWalletsMap.has(identifier))
            return WalletVaultDelResult.NoSuchWallet;

        const index: number = this.identifierToWalletsMap.get(identifier);
        this.identifierToWalletsMap.delete(identifier)
        // TODO: swap the last and this and delete that
        this._deleteWalletAt(index);

        return WalletVaultDelResult.Successful;
    }

    // methods for TaggedRetriever

    getWalletsWithTag(tag: string): Array<Wallet> {
        tag = TaggedConcurrentWalletVault.normalize_tag(tag);
        if (!this.tagToWalletsMap.has(tag)) {
            return new Array<Wallet>();
        }
        const indices: Array<number> = this.tagToWalletsMap.get(tag)
        return indices
            .filter(i => i < this.wallets.length && i >= 0)
            .map(i => this.wallets[i]);
    }

    tagWalletWithIdentifier(identifier: string, tag: string): TaggingResult {
        if ("" == identifier) return TaggingResult.InvalidIdentifier
        tag = TaggedConcurrentWalletVault.normalize_tag(tag);
        if ("" == tag) return TaggingResult.InvalidTag

        if (!this.identifierToWalletsMap.has(identifier))
            return TaggingResult.NoSuchWallet;

        const wallet = this.identifierToWalletsMap.get(identifier);
        if (null == wallet) return TaggingResult.NoSuchWallet

        this.tagToWalletsMap.get(tag)?.push(wallet)
        return TaggingResult.Successful;
    }


}