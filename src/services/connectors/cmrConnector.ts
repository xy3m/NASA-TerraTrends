/**
 * NASA CMR Connector — Common Metadata Repository catalog search
 * Implements EarthDataConnector for metadata/collection discovery (not time series)
 */
import type {
  EarthDataConnector,
  ConnectorCapabilities,
  ConnectorFetchOptions,
  ConnectorFetchResult,
  VariableId,
} from './types';

const BASE_URL = 'https://cmr.earthdata.nasa.gov/search';

// ── CMR-specific response types ───────────────────────────────────────

export interface CMRCollection {
  id: string;
  title: string;
  summary: string;
  dataCenter: string;
  timeStart?: string;
  timeEnd?: string;
  platforms: string[];
  browseUrl?: string;
}

export interface CMRGranule {
  id: string;
  title: string;
  collectionConceptId: string;
  timeStart: string;
  timeEnd: string;
  browseUrl?: string;
  downloadLinks: string[];
}

// ── Helper functions ──────────────────────────────────────────────────

/**
 * Search CMR collections by keyword
 */
export async function searchCollections(
  keyword: string,
  pageSize: number = 10
): Promise<CMRCollection[]> {
  const url =
    `${BASE_URL}/collections.json` +
    `?keyword=${encodeURIComponent(keyword)}` +
    `&page_size=${pageSize}` +
    `&sort_key=-score`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CMR API returned status ${response.status}`);
    }

    const json = await response.json();
    const feed = json?.feed?.entry || [];

    return feed.map((entry: Record<string, unknown>) => ({
      id: (entry.id as string) || '',
      title: (entry.title as string) || '',
      summary: (entry.summary as string) || '',
      dataCenter: (entry.data_center as string) || '',
      timeStart: (entry.time_start as string) || undefined,
      timeEnd: (entry.time_end as string) || undefined,
      platforms: Array.isArray(entry.platforms)
        ? (entry.platforms as Array<Record<string, string>>).map(p => p.short_name || '')
        : [],
      browseUrl: Array.isArray(entry.links)
        ? ((entry.links as Array<Record<string, string>>).find(
            l => l.rel === 'http://esipfed.org/ns/fedsearch/1.1/browse#'
          )?.href || undefined)
        : undefined,
    }));
  } catch (err) {
    console.warn('CMR collection search error:', err);
    return [];
  }
}

/**
 * Search CMR granules for a given collection
 */
export async function searchGranules(
  collectionId: string,
  bbox?: [number, number, number, number],
  pageSize: number = 10
): Promise<CMRGranule[]> {
  let url =
    `${BASE_URL}/granules.json` +
    `?collection_concept_id=${encodeURIComponent(collectionId)}` +
    `&page_size=${pageSize}` +
    `&sort_key=-start_date`;

  if (bbox) {
    url += `&bounding_box=${bbox.join(',')}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CMR API returned status ${response.status}`);
    }

    const json = await response.json();
    const feed = json?.feed?.entry || [];

    return feed.map((entry: Record<string, unknown>) => ({
      id: (entry.id as string) || '',
      title: (entry.title as string) || '',
      collectionConceptId: collectionId,
      timeStart: (entry.time_start as string) || '',
      timeEnd: (entry.time_end as string) || '',
      browseUrl: Array.isArray(entry.links)
        ? ((entry.links as Array<Record<string, string>>).find(
            l => l.rel === 'http://esipfed.org/ns/fedsearch/1.1/browse#'
          )?.href || undefined)
        : undefined,
      downloadLinks: Array.isArray(entry.links)
        ? (entry.links as Array<Record<string, string>>)
            .filter(l => l.rel === 'http://esipfed.org/ns/fedsearch/1.1/data#')
            .map(l => l.href)
        : [],
    }));
  } catch (err) {
    console.warn('CMR granule search error:', err);
    return [];
  }
}

// ── Connector implementation ──────────────────────────────────────────

const cmrCapabilities: ConnectorCapabilities = {
  timeSeries: false,
  mapTiles: false,
  catalogSearch: true,
  pointSubset: false,
  regionSubset: true,
};

export const cmrConnector: EarthDataConnector = {
  id: 'nasa-cmr',
  name: 'NASA CMR Metadata Search',
  shortName: 'CMR',
  description:
    'NASA Common Metadata Repository — search and discover satellite data collections and granules across all NASA DAACs. Catalog/metadata only, not time series.',
  baseUrl: BASE_URL,
  capabilities: cmrCapabilities,
  supportedVariables: [], // Metadata search, not tied to specific variables
  provenanceType: 'satellite_observation',
  requiresAuth: false,
  requiresProxy: false,

  supportsVariable(_variableId: VariableId): boolean {
    // CMR is a catalog search; it doesn't produce time series for specific variables
    return false;
  },

  async fetchTimeSeries(_options: ConnectorFetchOptions): Promise<ConnectorFetchResult> {
    // CMR is a metadata connector — it doesn't provide time series data
    return {
      points: [],
      provenance: 'satellite_observation',
      sourceLabel: 'NASA CMR',
      statusMessage: 'CMR is a catalog search service. Use searchCollections() and searchGranules() for metadata queries.',
    };
  },
};
