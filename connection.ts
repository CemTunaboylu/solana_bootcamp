import { Connection, clusterApiUrl, Cluster } from "@solana/web3.js";

enum ConnectionType {
    LOCALHOST = "http://127.0.0.1:8899",
    TESTNET = "testnet"
}

const NO_TLS = false

class ConnectionManager {
    connectionsOfTypes: Map<ConnectionType, Connection>;

    constructor() {
        this.connectionsOfTypes = new Map<ConnectionType, Connection>();
    }

    get(connectionOfType: ConnectionType): Connection {
        if (this.connectionsOfTypes.has(connectionOfType)) {
            const connection = this.connectionsOfTypes.get(connectionOfType);
            // Is this even possible?
            if (undefined === connection)
                throw new Error(`established ${connectionOfType.valueOf()} cannot be retrieved.`)
            return connection
        }

        let connection: Connection;
        // casting to ConnectionType explicitly to avoid generated javascript code
        if (ConnectionType.LOCALHOST as ConnectionType === connectionOfType as ConnectionType) {
            connection = new Connection(ConnectionType.LOCALHOST.valueOf(), "confirmed");
        } else {
            connection = new Connection(clusterApiUrl(connectionOfType.valueOf() as Cluster, NO_TLS));
        }
        this.connectionsOfTypes.set(connectionOfType, connection);
        return connection;
    }
};