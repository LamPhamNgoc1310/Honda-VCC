// fe/src/hooks/MapDashboard/usePositionStatus.js
import { useState, useEffect } from 'react';

/** Area ID dùng SCM API */
const SCM_AREA_IDS = new Set([1, 2]);
const SCM_POSITION_STATUS_URL = 'http://192.168.50.16:6090/scm-service/api/position_status/';

/**
 * Hook lấy trạng thái vị trí kho từ SCM API.
 * Chỉ gọi khi areaId ∈ [1, 2]; gọi 1 lần khi mount/area đổi.
 *
 * Response mẫu:
 *   { code: 1000, data: [ { positionID: "10001397", enable: true, shelf: "Full", state: "Free", ... } ] }
 *
 * Return: { positionStatus: { "10001397": { ... }, ... }, loading, error }
 */
export function usePositionStatus(areaId = null) {
  const [positionStatus, setPositionStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refetchKey, setRefetchKey] = useState(0);

  /** Tăng refetchKey để trigger re-fetch toàn bộ */
  const refetch = () => setRefetchKey((k) => k + 1);

  /**
   * Cập nhật ngay 1 node trong positionStatus mà không cần chờ API.
   * Dùng sau khi gọi enable_position thành công để icon cập nhật tức thì.
   * @param {string|number} positionId - positionID của node
   * @param {Object} updates           - các trường cần ghi đè (vd: { enable: false })
   */
  const optimisticUpdate = (positionId, updates) => {
    setPositionStatus((prev) => {
      const key = String(positionId);
      return {
        ...prev,
        [key]: { ...(prev[key] ?? {}), ...updates },
      };
    });
  };

  useEffect(() => {
    if (!SCM_AREA_IDS.has(Number(areaId))) {
      setPositionStatus({});
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    // Giữ nguyên data cũ trong khi fetch để tránh flicker icon
    setLoading(true);
    setError(null);

    const fetchStatus = async () => {
      try {
        const res = await fetch(SCM_POSITION_STATUS_URL, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.code === 1000 && Array.isArray(json.data)) {
          const map = {};
          json.data.forEach((item) => {
            if (item.positionID != null) {
              map[String(item.positionID)] = item;
            }
          });
          setPositionStatus(map);
        }
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[usePositionStatus] fetch error:', err);
          setError(err.message || 'Lỗi kết nối SCM');
          setLoading(false);
        }
      }
    };

    fetchStatus();
    return () => { cancelled = true; };
  }, [areaId, refetchKey]);

  return { positionStatus, loading, error, refetch, optimisticUpdate };
}
