import { executeCommand } from './executeCommand';

interface MyInfo {
    myNodeNum?: number;
    minAppVersion?: number,
    rebootCount?: number
}

interface Metadata {
    firmwareVersion?: string;
    deviceStateVersion?: number;
    canShutdown?: boolean;
    hasBluetooth?: boolean;
    positionFlags?: number;
    hwModel?: string;
    hasPKC?: boolean;
    hasWifi?: boolean;
    hasEthernet?: boolean;
    role?: string;
    hasRemoteHardware?: boolean;
}

interface NodeUser {
    id: string;
    longName: string;
    shortName: string;
    macaddr: string;
    hwModel: string;
    publicKey?: string;
}

interface NodePosition {
    latitudeI: number;
    longitudeI: number;
    altitude: number;
    time: number;
    locationSource: string;
    latitude: number;
    longitude: number;
}

interface NodeEntry {
    num: number;
    user: NodeUser;
    position: NodePosition;
    lastHeard: number;
    deviceMetrics: NodeDeviceMetrics;
    isFavorite: boolean;
}

interface NodeDeviceMetrics {
    batteryLevel: number;
    voltage: number;
    channelUtilization: number;
    airUtilTx: number;
    uptimeSeconds: number;
}

interface NodeInfo {
    owner: string;
    myInfo: MyInfo;
    metadata: Metadata;
    primaryChannelURL: string;
    nodes: NodeEntry[];
}

function errorHandler(err: unknown) {
    if (err instanceof Error) {
        // Handle standard Error
        console.error(`Command Error: ${err.message}`);
    } else {
        // Handle non-Error types
        console.error(`Command Error: ${JSON.stringify(err)}`);
    }
}

export async function checkCLI() {
    try {
        console.log('Looking for Meshtastic CLI...');
        const output = await executeCommand('meshtastic --version');
        console.log(`Detected Meshtastic CLI v${output}`);
        return true;
    } catch (err: unknown) {
        errorHandler(err);
        return false;
    }
}

export async function traceroute(node: string) {
    try {
        const output = await executeCommand(`meshtastic --traceroute ${node} --timeout 15`);
        return output;
    } catch (err: unknown) {
        errorHandler(err);
    }
}

export async function getNodeInfo(): Promise<NodeInfo | undefined> {
    try {
        console.log('Getting node info...');
        const output = await executeCommand('meshtastic --info');
        const nodeInfo = await parseNodeInfo(output);
        return nodeInfo;
    } catch (err: unknown) {
        errorHandler(err);
    }
}

async function parseNodeInfo(nodeInfo: string): Promise<NodeInfo> {    
    let owner = '';
    let metadata = {};
    let myInfo = {};
    let primaryChannelURL = '';
    let nodes = '';
    let nodesList = [];
    let nowParsing: string | null = null;

    const lines = nodeInfo.split('\r\n');
    for (const line of lines) {
        // console.log(line);
        if (line.trim() === '') {
            if (nowParsing === 'nodes') {                
                nodesList = JSON.parse(nodes);
            }
            nowParsing = null;
        } else if (line.substring(0, 6) === 'Owner:') {
            owner = line.substring(7);
        } else if (line.substring(0, 8) === 'My info:') {
            myInfo = JSON.parse(line.substring(9)) || {};
        } else if (line.substring(0, 9) === 'Metadata:') {
            metadata = JSON.parse(line.substring(10)) || {};
        } else if (line.substring(0, 20) === 'Primary channel URL:') {
            primaryChannelURL = line.substring(21);
        } else if (line.substring(0, 14) === 'Nodes in mesh:' || nowParsing === 'nodes') {
            nowParsing = 'nodes';
            if (line.substring(0, 14) === 'Nodes in mesh:') {
                nodes += line.substring(15);
            } else {
                nodes += line;
            }
        }
    }

    return {
        owner,
        myInfo,
        metadata,
        primaryChannelURL,
        nodes: nodesList
    };
}