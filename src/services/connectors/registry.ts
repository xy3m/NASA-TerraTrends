/**
 * Connector Registry — Central registry for all EarthDataConnectors
 */
import type { EarthDataConnector, VariableId } from './types';

class ConnectorRegistry {
  private connectors: Map<string, EarthDataConnector> = new Map();

  /** Register a connector */
  register(connector: EarthDataConnector): void {
    this.connectors.set(connector.id, connector);
  }

  /** Get a connector by ID */
  get(id: string): EarthDataConnector | undefined {
    return this.connectors.get(id);
  }

  /** Get all registered connectors */
  getAll(): EarthDataConnector[] {
    return Array.from(this.connectors.values());
  }

  /** Find all connectors that support a given variable */
  findForVariable(variableId: VariableId): EarthDataConnector[] {
    return this.getAll().filter(c => c.supportsVariable(variableId));
  }

  /**
   * Get the best connector for a variable at a given location.
   * Prioritizes satellite_observation > reanalysis_model,
   * then connectors with time series capability,
   * then connectors with point subset capability.
   */
  getBestConnector(
    variableId: VariableId,
    _lat: number,
    _lon: number
  ): EarthDataConnector | undefined {
    const candidates = this.findForVariable(variableId);
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    // Sort by priority: satellite_observation first, then timeSeries capability
    const provenanceOrder: Record<string, number> = {
      satellite_observation: 0,
      reanalysis_model: 1,
      user_upload: 2,
      synthetic_demo: 3,
    };

    candidates.sort((a, b) => {
      const pa = provenanceOrder[a.provenanceType] ?? 9;
      const pb = provenanceOrder[b.provenanceType] ?? 9;
      if (pa !== pb) return pa - pb;

      // Prefer time-series capable connectors
      if (a.capabilities.timeSeries !== b.capabilities.timeSeries) {
        return a.capabilities.timeSeries ? -1 : 1;
      }

      return 0;
    });

    return candidates[0];
  }
}

export const connectorRegistry = new ConnectorRegistry();
