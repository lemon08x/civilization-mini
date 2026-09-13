import { DEVICES } from './product-network.js';
export function actionId(action) {
    if (action.type === 'fabricate' || action.type === 'install-product')
        return `${action.type}:${action.device}`;
    if (action.type === 'develop')
        return `develop:${action.recipe}`;
    if (action.type === 'refine' || action.type === 'mentor')
        return `${action.type}:${action.domain}`;
    if (action.type === 'procure' || action.type === 'deliver')
        return `${action.type}:${action.good}`;
    if (action.type === 'equip')
        return `equip:${action.kind}`;
    if (action.type === 'entrust' || action.type === 'pause-contract' || action.type === 'buy-good')
        return `${action.type}:${action.material}`;
    if (action.type === 'share')
        return `share:${action.nodeId}`;
    if (action.type === 'gather')
        return `gather:${action.resource}`;
    if (action.type === 'craft')
        return `craft:${action.recipe}`;
    if (action.type === 'sell-good' || action.type === 'install-storage' || action.type === 'build-workshop' || action.type === 'craft-batch')
        return `${action.type}:${action.material}`;
    if (action.type === 'buy-method')
        return `buy-method:${action.nodeId}`;
    if (action.type === 'practice')
        return `practice:${action.nodeId}:${action.practiceId}`;
    if (action.type === 'study' || action.type === 'archive' || action.type === 'teach')
        return `${action.type}:${action.nodeId}`;
    if (action.type === 'release')
        return `release:${action.decision}`;
    return action.type;
}
export function parseActionId(id) {
    if (typeof id !== 'string' || id.length > 160)
        throw new Error('行动 ID 无效');
    const parts = id.split(':');
    const [type, nodeId, practiceId] = parts;
    if (parts.length === 2 && (type === 'fabricate' || type === 'install-product') && DEVICES.includes(nodeId))
        return { type, device: nodeId };
    if (parts.length === 1 && ['finish-product', 'calibrate', 'pump-water', 'recycle-ceramics'].includes(type))
        return { type: type };
    if (parts.length === 1 && ['finish-development', 'conduct-experiment', 'procure-clay'].includes(type))
        return { type: type };
    if (parts.length === 2 && type === 'develop' && ['supplies', 'ceramicParts', 'mechanisms', 'fieldTools', 'labTools', 'precisionParts'].includes(nodeId))
        return { type, recipe: nodeId };
    if (parts.length === 2 && (type === 'refine' || type === 'mentor') && ['pottery', 'woodwork', 'agriculture', 'science'].includes(nodeId))
        return { type, domain: nodeId };
    if (parts.length === 2 && (type === 'procure' || type === 'deliver') && ['supplies', 'ceramicParts', 'mechanisms', 'fieldTools', 'labTools', 'precisionParts'].includes(nodeId))
        return { type, good: nodeId };
    if (parts.length === 2 && type === 'equip' && (nodeId === 'field' || nodeId === 'lab'))
        return { type, kind: nodeId };
    if ((type === 'entrust' || type === 'pause-contract' || type === 'buy-good') && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId))
        return { type, material: nodeId };
    if (type === 'share' && parts.length === 2 && nodeId)
        return { type, nodeId };
    if (type === 'finish-craft' && parts.length === 1)
        return { type };
    if (type === 'gather' && parts.length === 2 && ['food', 'wood', 'clay'].includes(nodeId))
        return { type, resource: nodeId };
    if (type === 'craft' && parts.length === 2 && ['woodenware', 'pottery', 'gather-tool'].includes(nodeId))
        return { type, recipe: nodeId };
    if ((type === 'build-workshop' || type === 'craft-batch') && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId))
        return { type, material: nodeId };
    if (['sell-good', 'install-storage'].includes(type) && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId))
        return { type: type, material: nodeId };
    if (type === 'buy-method' && parts.length === 2 && nodeId)
        return { type, nodeId };
    if (['study', 'archive', 'teach'].includes(type) && parts.length === 2 && nodeId)
        return { type: type, nodeId };
    if (type === 'practice' && parts.length === 3 && nodeId && practiceId)
        return { type, nodeId, practiceId };
    if (type === 'release' && parts.length === 2 && (nodeId === 'keep' || nodeId === 'adopt'))
        return { type, decision: nodeId };
    if (parts.length === 1 && ['cultivate', 'work', 'buy-food', 'buy-food-bulk', 'sell-food', 'build-channel', 'repair-channel', 'prepare-seed', 'start-trial', 'end-turn', 'handover'].includes(type))
        return { type: type };
    throw new Error(`未知行动：${id}`);
}
