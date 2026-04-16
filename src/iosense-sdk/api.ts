import type { Device, Cluster, WidgetDataResponse } from './types';

const BASE_URL = 'https://connector.iosense.io/api';

// Auth: use prop token in prod; fall back to localStorage in dev.
function getToken(authentication?: string): string {
  return authentication ?? localStorage.getItem('bearer_token') ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Device APIs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paginated device search. Response nested at response.data.data (not response.data).
 * Use for AutocompleteInput in config panel — call on every keystroke (debounce 300ms).
 */
export async function findUserDevices(
  authentication: string | undefined,
  searchValue: string,
  page = 1,
  limit = 20
): Promise<Device[]> {
  const token = getToken(authentication);
  const res = await fetch(`${BASE_URL}/account/devices/${page}/${limit}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngsw-bypass': 'true',
    },
    body: JSON.stringify({
      search: searchValue.trim() ? { all: [searchValue.trim()] } : [],
      filter: [],
      order: 'default',
      sort: 'AtoZ',
    }),
  });
  const json = await res.json();
  // Double-nested: response.data.data
  return (json?.data?.data as Device[]) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cluster (load entity) APIs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paginated cluster list. Response nested at response.data.data.
 * Use for AutocompleteInput in config panel.
 */
export async function fetchClusters(
  authentication: string | undefined,
  searchValue = '',
  page = 1,
  limit = 20
): Promise<Cluster[]> {
  const token = getToken(authentication);
  const res = await fetch(`${BASE_URL}/account/load-entities-gen/${page}/${limit}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      archive: false,
      search: searchValue.trim() ? { name: [searchValue.trim()] } : {},
      sort: 'timeUpdated',
      order: 'decrement',
      deviceProjection: 'devName,devID',
    }),
  });
  const json = await res.json();
  // Double-nested: response.data.data
  return (json?.data?.data as Cluster[]) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget data (all source types — device, cluster, compute)
// ─────────────────────────────────────────────────────────────────────────────

export interface WidgetDataConfigEntry {
  type: 'device' | 'cluster' | 'compute';
  devID?: string;
  sensor?: string;
  clusterID?: string;
  flowId?: string;
  flowParams?: string;
  operator: string;
  key: string;
}

/**
 * getWidgetData — aggregated time-series for devices, clusters, and compute.
 * The only API that natively handles all three source types.
 *
 * Response shape:
 *   json.data.data[timeFrame][bucket][] = { type, key, data, operator, ... }
 */
export async function getWidgetData(
  authentication: string | undefined,
  configs: WidgetDataConfigEntry[],
  startTime: number,
  endTime: number,
  timezone = 'Asia/Calcutta',
  timeFrame = 'day'
): Promise<WidgetDataResponse> {
  const token = getToken(authentication);
  const res = await fetch(`${BASE_URL}/account/ioLensWidget/getWidgetData`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startTime,
      endTime,
      timezone,
      timeBucket: ['year', 'month', 'day', 'hour'],
      timeFrame,
      type: 'progressBar',
      cycleTime: '00:00',
      config: configs,
    }),
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper (dev only — validate SSO token, store JWT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dev-only: validate an SSO token from the URL (?token=xxx) and store the
 * resulting Bearer JWT in localStorage for all subsequent API calls.
 * In production Lens passes the JWT directly as the `authentication` prop.
 */
export async function validateSSOToken(ssoToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/account/validateSSOToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ssoToken }),
    });
    const json = await res.json();
    const jwt: string = json?.data?.token ?? json?.token ?? '';
    if (jwt) {
      localStorage.setItem('bearer_token', jwt);
      return jwt;
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Value extraction helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract aggregated value for a given key from a getWidgetData response.
 * Sums all bucket values — correct for Sum/Consumption operators.
 * For LastDP use the final bucket value instead; pass sumAll=false.
 */
export function extractValue(
  response: WidgetDataResponse,
  key: string,
  timeFrame = 'day',
  sumAll = true
): number | null {
  const timeFrameData = response?.data?.data?.[timeFrame];
  if (!timeFrameData) return null;

  const buckets = Object.keys(timeFrameData).sort();
  if (buckets.length === 0) return null;

  if (!sumAll) {
    // Take last bucket only (e.g. for LastDP)
    const last = buckets[buckets.length - 1];
    const entry = timeFrameData[last]?.find((e) => e.key === key);
    if (entry?.data === undefined || entry?.data === null) return null;
    const v = parseFloat(String(entry.data));
    return isNaN(v) ? null : v;
  }

  let total = 0;
  let found = false;
  for (const bucket of buckets) {
    const entry = timeFrameData[bucket]?.find((e) => e.key === key);
    if (entry?.data !== undefined && entry?.data !== null) {
      const v = parseFloat(String(entry.data));
      if (!isNaN(v)) {
        total += v;
        found = true;
      }
    }
  }
  return found ? total : null;
}
