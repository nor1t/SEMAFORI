// ── Snapshot + pipeline-health helpers for the semafori-vision service ──
//
// The Python scheduler serves the contents of its `output/` directory over
// HTTP (annotated snapshots + health.json).  Locally that is
// http://localhost:8001; in production it is the Render HTTPS URL, configured
// via VITE_SNAPSHOT_BASE_URL.

export const SNAPSHOT_BASE = (
  import.meta.env.VITE_SNAPSHOT_BASE_URL || 'http://localhost:8001'
).replace(/\/$/, '');

/**
 * URL of the latest annotated snapshot for a camera slug (e.g. "pejton").
 * `tick` is appended as a cache-buster so browsers refetch the image.
 */
export function snapshotUrl(camName, tick) {
  return `${SNAPSHOT_BASE}/latest_${camName}.jpg?t=${tick ?? ''}`;
}

/**
 * GET `${SNAPSHOT_BASE}/health.json`.
 * Returns the parsed JSON object, or null on any network/HTTP/parse error.
 */
export async function fetchPipelineHealth(signal) {
  try {
    const response = await fetch(`${SNAPSHOT_BASE}/health.json`, {
      signal,
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
