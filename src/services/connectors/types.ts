/**
 * Connector Types — Re-exports from earthScience.ts + connector-specific helpers
 */
export type {
  VariableId,
  VariableCategory,
  MeasurementType,
  ProvenanceTier,
  EarthVariable,
  TimeSeriesPoint,
  TrendAnalysisResult,
  ConnectorCapabilities,
  ConnectorFetchOptions,
  ConnectorFetchResult,
  EarthDataConnector,
} from '../../types/earthScience';

export { PROVENANCE_META } from '../../types/earthScience';

// ── Connector-specific helpers ────────────────────────────────────────

/** Haversine distance in km between two lat/lon points */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Convert day-of-year to month (1-based) */
export function dayOfYearToMonth(doy: number, year: number): number {
  const date = new Date(year, 0, doy);
  return date.getMonth() + 1;
}

/** Days in a given month (1-based) */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Default connector capabilities (all false) */
export function defaultCapabilities(): import('../../types/earthScience').ConnectorCapabilities {
  return {
    timeSeries: false,
    mapTiles: false,
    catalogSearch: false,
    pointSubset: false,
    regionSubset: false,
  };
}
