import { executeCommand } from './executeCommand';
import config from './config';

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

export interface NodeEntry {
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

interface RouteHop {
    from: string;
    to: string;
    signalStrength: number;
}

interface TracerouteResult {
    outboundRoute: RouteHop[];
    inboundRoute: RouteHop[];
    success: boolean;
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
        console.log(`Tracerouting to ${node}...`);
        const output = await executeCommand(`meshtastic --traceroute ${node}`);
        
        // Check if output contains timeout error
        if (output.search(/Timed out waiting for traceroute/i) !== -1) {
            throw new Error('Traceroute timed out');
        }
        
        // Check if output contains other error messages
        if (output.search(/Aborting due to:/i) !== -1) {
            const errorMatch = output.match(/Aborting due to: (.+)/);
            if (errorMatch) {
                throw new Error(errorMatch[1].trim());
            }
            throw new Error('Unknown traceroute error');
        }

        return output;
    } catch (err: unknown) {
        // Check if the error message contains timeout information
        if (err instanceof Error && err.message.search(/Timed out waiting for traceroute/i) !== -1) {
            return `Failed to traceroute to ${node}: Traceroute timed out`;
        }
        return `Failed to traceroute to ${node}: ${err instanceof Error ? err.message : 'Unknown error'}`;
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

    const lines = nodeInfo.split(/\r?\n/);
    for (const line of lines) {
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

export function convertNodeNumToId(nodeNum: number): string {
    // Convert to hex and remove '0x' prefix, ensure lowercase
    const hexNum = nodeNum.toString(16).toLowerCase();
    return `!${hexNum}`;
}

export function convertIdToNodeNum(id: string): number {
    // Remove '!' prefix, ensure lowercase
    const hexNum = id.substring(1).toLowerCase();
    return parseInt(hexNum, 16);
}

export function parseTraceroute(output: string): TracerouteResult {
    const result: TracerouteResult = {
        outboundRoute: [],
        inboundRoute: [],
        success: false
    };

    // Skip if error message
    if (output.startsWith('Failed to traceroute')) {
        return result;
    }

    const lines = output.split('\n');
    let isOutbound = true;

    for (const line of lines) {
        if (line.includes('Route traced back to us:')) {
            isOutbound = false;
            continue;
        }
        
        // Look for lines containing --> and dB
        if (line.includes('-->')) {
            const hops = line.split('-->').map(h => h.trim());
            
            // Process each hop pair in the line
            for (let i = 0; i < hops.length - 1; i++) {
                const fromNode = hops[i].split(' ')[0];  // Get node ID before any dB value
                const toMatch = hops[i + 1].match(/(![\w]+)\s+\(([-\d.]+)dB\)/);
                
                if (toMatch) {
                    const hop: RouteHop = {
                        from: fromNode,
                        to: toMatch[1],
                        signalStrength: parseFloat(toMatch[2])
                    };
                    
                    if (isOutbound) {
                        result.outboundRoute.push(hop);
                    } else {
                        result.inboundRoute.push(hop);
                    }
                }
            }
        }
    }

    result.success = result.outboundRoute.length > 0 || result.inboundRoute.length > 0;
    return result;
}