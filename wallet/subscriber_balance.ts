import { Connection } from '@solana/web3.js';

import { ConnectionManager, ConnectionType } from './connection';

let cm = new ConnectionManager();
let localhostConnection = cm.get(ConnectionType.LOCALHOST);

localhostConnection.onAccountChange