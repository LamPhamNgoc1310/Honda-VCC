// fe/src/hooks/MapDashboard/useCameraState.js
import { useState, useEffect, useCallback } from 'react';

const ICS_AREA_IDS = new Set([1, 2]);
const ICS_CAMERA_STATUS_URL = 'http://192.168.50.16:6050/monitor-service/api/camera_status/';

const normalizeFromICS = (data) => {
  const result = {};
  (data || []).forEach((cam) => {
    const idx = cam.cameraId;
    if (idx == null) return;
    result[idx] = {
      online: cam.status === 'Connected' && cam.enable === true,
      last_seen: cam.updated_at ?? null,
      raw: cam,
    };
  });
  return result;
};

/**
 * Hook lấy trạng thái camera.
 * - areaId ∈ [1, 2]: GET ICS API một lần khi mount
 * - Các area khác: trả về state rỗng (không gọi API)
 */
export function useCameraState(areaId = null) {
  const [cameraState, setCameraState] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const useICS = ICS_AREA_IDS.has(Number(areaId));

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  const optimisticUpdate = useCallback((cameraId, updates) => {
    setCameraState((prev) => {
      const key = Number(cameraId);
      const existing = prev[key] ?? {};
      const newRaw = { ...(existing.raw ?? {}), ...updates };
      return {
        ...prev,
        [key]: {
          ...existing,
          online: newRaw.status === 'Connected' && newRaw.enable === true,
          raw: newRaw,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (!useICS) {
      setCameraState({});
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchStatus = async () => {
      try {
        const res = await fetch(ICS_CAMERA_STATUS_URL, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.code === 1000 && Array.isArray(json.data)) {
          setCameraState(normalizeFromICS(json.data));
        }
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[useCameraState] ICS fetch error:', err);
          setError(err.message || 'Lỗi kết nối ICS');
          setLoading(false);
        }
      }
    };

    fetchStatus();
    return () => { cancelled = true; };
  }, [useICS, refetchKey]);

  return { cameraState, loading, error, refetch, optimisticUpdate };
}
