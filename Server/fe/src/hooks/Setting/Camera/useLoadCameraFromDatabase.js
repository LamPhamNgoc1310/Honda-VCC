import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const MONITOR_CAMERA_CONFIG_URL = 'http://192.168.50.16:6050/monitor-service/api/camera_config';

/**
 * Fetch camera config từ monitor-service (dùng cho area 1 & 2)
 * Response: { code, desc, data: [{ url, cameraId, area_name, source_owner, type_model, node_id, rois: { nodeId: [x,y,w,h] } }] }
 */
const fetchMonitorCameraConfig = async () => {
  const response = await axios.get(MONITOR_CAMERA_CONFIG_URL);
  return response.data?.data || [];
};

/**
 * Map 1 camera từ monitor-service format sang frontend format
 */
const mapMonitorCamera = (cam, areaId, index) => ({
  id: String(cam.cameraId ?? index),
  camera_id: cam.cameraId ?? index,
  camera_name: String(cam.cameraId ?? index),
  camera_path: cam.url || '',
  area_name: cam.area_name || '',
  source_owner: cam.source_owner ?? null,
  type_model: cam.type_model ?? null,
  node_id: cam.node_id || '',
  area: areaId,
  isNew: false,
  roi: Object.entries(cam.rois || {}).map(([nodeId, coords], i) => ({
    x: coords[0],
    y: coords[1],
    width: coords[2],
    height: coords[3],
    label: `ROI ${i + 1}`,
    task_path: nodeId
  })).filter(roi => roi.width > 0 && roi.height > 0)
});

/**
 * Custom hook để load cameras theo area
 * - Area 1 hoặc 2: gọi monitor-service API
 * - Area khác: trả về danh sách rỗng
 */
export const useLoadCameraFromDatabase = (areaId, t) => {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCameras = useCallback(async () => {
    try {
      setLoading(true);

      const numericAreaId = Number(areaId);

      if (numericAreaId === 1 || numericAreaId === 2) {
        const data = await fetchMonitorCameraConfig();

        const areaNameFilter = numericAreaId === 1 ? 'MS2' : 'WE';
        const filtered = data.filter(cam => cam.area_name === areaNameFilter);

        const formattedCameras = filtered.map((cam, i) => mapMonitorCamera(cam, areaId, i));
        setCameras(formattedCameras);
        console.log(`[DEBUG-formattedCameras-monitor] area=${numericAreaId} filter="${areaNameFilter}"`, formattedCameras);
      } else {
        setCameras([]);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
      alert(t('settings.errorLoadingCameras'));
    } finally {
      setLoading(false);
    }
  }, [areaId, t]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  return {
    cameras,
    setCameras,
    loading,
    refetch: loadCameras
  };
};

