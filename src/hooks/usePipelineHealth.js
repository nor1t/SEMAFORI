import { useEffect, useRef, useState } from 'react';
import { fetchPipelineHealth } from '../shared/snapshots';

const POLL_INTERVAL_MS = 60000;

/**
 * Polls the semafori-vision pipeline's health.json every 60 s.
 *
 * Returns { health, online }:
 *   health — parsed health.json ({ updated_utc, pipeline_mode, cameras: {...} })
 *            or null if it has never been fetched successfully.
 *   online — true if the most recent fetch succeeded.
 *
 * Cleans up the interval and ignores late responses after unmount.
 */
export function usePipelineHealth() {
  const [health, setHealth] = useState(null);
  const [online, setOnline] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let controller = new AbortController();

    const poll = async () => {
      controller.abort();
      controller = new AbortController();
      const result = await fetchPipelineHealth(controller.signal);
      if (!mountedRef.current) return;
      if (result) {
        setHealth(result);
        setOnline(true);
      } else {
        setOnline(false);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  return { health, online };
}

export default usePipelineHealth;
