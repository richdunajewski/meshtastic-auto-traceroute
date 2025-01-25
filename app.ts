import { checkCLI, getNodeInfo, traceroute, convertNodeNumToId, parseTraceroute, NodeEntry } from './meshtastic';
import config from './config';

let activeNodes = {};

(async () => {
    if (await checkCLI()) {
        await updateActiveNodes();
    }
})();

async function updateActiveNodes() {
    const nodeInfo = await getNodeInfo();
    if (nodeInfo) {
        // console.log(`Owner: ${nodeInfo.owner}`);
        // console.log(`My Info: ${JSON.stringify(nodeInfo.myInfo)}`);
        console.log(`My Node Num: ${JSON.stringify(nodeInfo.myInfo.myNodeNum)} (${convertNodeNumToId(nodeInfo.myInfo.myNodeNum || 0)})`);
        // console.log(`Metadata: ${JSON.stringify(nodeInfo.metadata)}`);
        // console.log(`Primary Channel URL: ${nodeInfo.primaryChannelURL}`);
        // console.log(`Nodes: ${Object.keys(nodeInfo.nodes).length} nodes`);
        // console.log(Object.keys(activeNodes).length);

        // Find nodes that were added or removed
        const previousNodes = Object.keys(activeNodes);
        const currentNodes = Object.keys(nodeInfo.nodes);
        const addedNodes = currentNodes.filter(node => !previousNodes.includes(node));
        const removedNodes = previousNodes.filter(node => !currentNodes.includes(node));

        // Only traceroute newly appeared nodes that aren't our own node
        for (const newNode of addedNodes) {
            if (newNode !== convertNodeNumToId(nodeInfo.myInfo.myNodeNum || 0)) {
                const foundNode = nodeInfo.nodes[newNode as keyof typeof nodeInfo.nodes] as NodeEntry;
                console.log(`New node appeared: ${newNode} ${foundNode?.user?.shortName} ${foundNode?.user?.longName}`);
                const routeOutput = await traceroute(newNode);
                const parsedRoute = parseTraceroute(routeOutput);
                if (parsedRoute.success) {
                    console.log('Outbound route:', parsedRoute.outboundRoute);
                    console.log('Inbound route:', parsedRoute.inboundRoute);
                } else {
                    console.log('Failed to trace route');
                }
            }
        }

        // Optionally log removed nodes without attempting traceroute
        for (const removedNode of removedNodes) {
            console.log(`Node disappeared: ${removedNode}`);
        }

        activeNodes = nodeInfo.nodes;
    } else {
        console.log('No node info found');
    }

    setTimeout(updateActiveNodes, config.updateInterval);
}