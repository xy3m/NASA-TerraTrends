/**
 * Earth Data Connectors — Unified Registry & Connectors Export
 */
import { connectorRegistry } from './registry';
import { powerConnector } from './powerConnector';
import { modisConnector } from './modisConnector';
import { cmrConnector } from './cmrConnector';
import { gibsConnector } from './gibsConnector';
import { noaaConnector } from './noaaConnector';
import { usgsConnector } from './usgsConnector';

// Register all available Phase 1 client connectors
connectorRegistry.register(powerConnector);
connectorRegistry.register(modisConnector);
connectorRegistry.register(cmrConnector);
connectorRegistry.register(gibsConnector);
connectorRegistry.register(noaaConnector);
connectorRegistry.register(usgsConnector);

export { connectorRegistry };
export { powerConnector } from './powerConnector';
export { modisConnector } from './modisConnector';
export { cmrConnector } from './cmrConnector';
export { gibsConnector } from './gibsConnector';
export { noaaConnector } from './noaaConnector';
export { usgsConnector } from './usgsConnector';

export * from './types';
export * from './registry';
