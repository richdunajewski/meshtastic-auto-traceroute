import { xor } from 'lodash';
import { checkCLI, getNodeInfo, traceroute } from './meshtastic';

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
        // console.log(`Metadata: ${JSON.stringify(nodeInfo.metadata)}`);
        // console.log(`Primary Channel URL: ${nodeInfo.primaryChannelURL}`);
        // console.log(`Nodes: ${Object.keys(nodeInfo.nodes).length} nodes`);
        // console.log(Object.keys(activeNodes).length);

        // compare active nodes to new nodes
        const diff = xor(Object.keys(activeNodes), Object.keys(nodeInfo.nodes));

        for(const diffItem of diff){
            console.log(diffItem);
            const route = await traceroute(diffItem);
            console.log(route);
        }

        activeNodes = nodeInfo.nodes;
    }

    setTimeout(updateActiveNodes, 60000);
}