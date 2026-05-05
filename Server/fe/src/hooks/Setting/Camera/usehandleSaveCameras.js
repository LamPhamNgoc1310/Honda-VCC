import { useState } from 'react';
import axios from 'axios';
import { addCamera, updateCamera } from '@/services/camera-settings';

const MONITOR_CAMERA_CONFIG_URL = 'http://192.168.50.16:6050/monitor-service/api/camera_config';
const MONITOR_CAMERA_UPDATE_URL = 'http://192.168.50.16:6050/monitor-service/api/camera_config/update';

// Map area_id → area_name dùng để lọc
const AREA_NAME_MAP = { 1: 'MS2', 2: 'WE' };

/**
 * Validation helpers
 */
const validateRTSPUrl = (url) => {
  const rtspRegex = /^rtsp:\/\/(?:[^\s@]+@)?[\w\-\.]+(:\d+)?(\/.*)?$/i;
  return rtspRegex.test(url);
};

const validateROI = (roi) => {
  return (
    roi &&
    typeof roi === 'object' &&
    typeof roi.x === 'number' && roi.x >= 0 &&
    typeof roi.y === 'number' && roi.y >= 0 &&
    typeof roi.width === 'number' && roi.width > 0 &&
    typeof roi.height === 'number' && roi.height > 0
  );
};

/**
 * Convert 1 camera từ frontend format → backend format của monitor-service
 */
const toMonitorBackendFormat = (cam) => ({
  url: cam.camera_path || '',
  cameraId: cam.camera_id,
  area_name: cam.area_name || '',
  source_owner: cam.source_owner ?? null,
  type_model: cam.type_model ?? null,
  node_id: cam.node_id || '',
  rois: Object.fromEntries(
    (cam.roi || [])
      .filter(validateROI)
      .map(roi => [
        roi.task_path,
        [Math.round(roi.x), Math.round(roi.y), Math.round(roi.width), Math.round(roi.height)]
      ])
  )
});

/**
 * Custom hook để xử lý việc lưu cameras
 * @param {Array} cameras - Danh sách cameras đang chỉnh sửa
 * @param {function} refetchCameras - Hàm để reload cameras
 * @param {function} t - Translation function
 * @param {number} areaId - ID của area hiện tại
 */
export const useHandleSaveCameras = (cameras, refetchCameras, t, areaId) => {
  const [saving, setSaving] = useState(false);

  const handleSaveCameras = async () => {
    try {
      setSaving(true);

      // Validate
      const invalidCameras = cameras.filter(camera =>
        (camera.camera_path && !validateRTSPUrl(camera.camera_path)) ||
        (Array.isArray(camera.roi) && camera.roi.some(roi => !validateROI(roi)))
      );

      if (invalidCameras.length > 0) {
        alert(t('settings.invalidRTSPUrlsOrBbox'));
        return;
      }

      const numericAreaId = Number(areaId);

      if (numericAreaId === 1 || numericAreaId === 2) {
        // Lấy toàn bộ data gốc từ API (chưa lọc area_name)
        const response = await axios.get(MONITOR_CAMERA_CONFIG_URL);
        const allCameras = response.data?.data || [];

        // Giữ lại các camera KHÔNG thuộc area hiện tại
        const currentAreaName = AREA_NAME_MAP[numericAreaId];
        const otherAreaCameras = allCameras.filter(cam => cam.area_name !== currentAreaName);

        // Convert các camera đang chỉnh sửa sang backend format
        const editedCameras = cameras.map(toMonitorBackendFormat);

        // Gộp: cameras khu vực khác + cameras khu vực hiện tại (đã chỉnh sửa)
        const mergedPayload = [...otherAreaCameras, ...editedCameras];

        console.log(`[DEBUG-save] area=${numericAreaId} filter="${currentAreaName}"`, mergedPayload);
        await axios.post(MONITOR_CAMERA_UPDATE_URL, mergedPayload);
      } else {
        // Logic cũ cho các area khác (dùng internal API)
        for (const camera of cameras) {
          const mapping = (camera.roi || [])
            .filter(validateROI)
            .map(roi => ({
              roi: [
                Math.round(roi.x),
                Math.round(roi.y),
                Math.round(roi.width),
                Math.round(roi.height)
              ],
              position: roi.task_path ? parseInt(roi.task_path) : 0
            }));

          const cameraData = {
            camera_id: camera.camera_id,
            camera_name: camera.camera_name,
            camera_path: camera.camera_path,
            mapping,
            area: camera.area
          };

          if (camera.isNew) {
            if (camera.camera_name && camera.camera_path) {
              await addCamera(cameraData);
            }
          } else {
            await updateCamera({ ...cameraData, id: camera.id });
          }
        }
      }

      await refetchCameras();
      alert(t('settings.cameraConfigurationSavedSuccessfully'));
    } catch (error) {
      console.error('Error saving cameras:', error);
      alert(t('settings.errorSavingCameraConfiguration'));
    } finally {
      setSaving(false);
    }
  };

  return {
    handleSaveCameras,
    saving,
    validateRTSPUrl,
    validateROI
  };
};

