import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import onlineCameraIcon from '@/assets/online_camera.png';
import offlineCameraIcon from '@/assets/offline_camera.png';

// Tính kích thước icon camera theo zoom (kích thước gốc: base 24, range 16–64)
const getCameraIconSizeByZoom = (map) => {
  if (!map) return [32, 32];
  const zoom = map.getZoom();
  const baseSize = 24;
  const scale = Math.pow(2, zoom);
  const size = Math.max(16, Math.min(64, Math.round(baseSize * scale)));
  return [size, size];
};

const Camera = ({
  mapInstance,
  mapData,
  showCameras,
  onCameraClick,
  focusCamera,
  cameraState = {},
}) => {
  const layerRef = useRef(null);
  const markersRef = useRef({});
  const { t } = useTranslation();
  useEffect(() => {
    try {
      if (!mapInstance || !mapData || !showCameras) {
        if (layerRef.current && mapInstance) {
          try {
            mapInstance.removeLayer(layerRef.current);
          } catch (error) {
            console.warn('Error removing camera layer:', error);
          }
          layerRef.current = null;
        }
        return;
      }

      if (!mapInstance.getContainer()) {
        console.warn('Map container missing, skipping camera render');
        return;
      }

      if (layerRef.current) {
        try {
          mapInstance.removeLayer(layerRef.current);
        } catch (error) {
          console.warn('Error removing existing camera layer:', error);
        }
      }

      const camerasLayer = L.layerGroup();

      if (mapData.nodeArr && Array.isArray(mapData.nodeArr)) {
        mapData.nodeArr.forEach((node) => {
          try {
            if (!node || typeof node.x === 'undefined' || typeof node.y === 'undefined') {
              return;
            }

            if (typeof node.name === 'string' && /^Camera\s*_?\s*\d+$/i.test(node.name.trim())) {
              // Chuẩn hóa tên để map: bỏ dấu _, gộp khoảng trắng (Camera_26 → "Camera 26")
              const normalizeName = (s) => (s || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
              const normalizedNodeName = normalizeName(node.name);

              // Extract camera ID từ tên (dùng cho online state)
              const cameraIndex = parseInt(node.name.replace(/Camera/i, '').replace(/[\s_]/g, '') || '0', 10);
              const camStatus = cameraState[cameraIndex];
              const isOnline = camStatus?.online || false;
              const raw = camStatus?.raw || {};
              const cameraName = node.name;

              const enableVal = raw.enable;
              const runningVal = raw.running_on_client;

              const boolLabel = (val) =>
                val !== undefined
                  ? val
                    ? `<span style="color:#52c41a">${t('map.boolYes')}</span>`
                    : `<span style="color:#ff4d4f">${t('map.boolNo')}</span>`
                  : '<span style="color:#999">—</span>';

              const currentSize = getCameraIconSizeByZoom(mapInstance);
              const cameraIcon = L.icon({
                iconUrl: isOnline ? onlineCameraIcon : offlineCameraIcon,
                iconSize: currentSize,
                iconAnchor: [Math.round(currentSize[0] / 2), Math.round(currentSize[1] / 2)],
                popupAnchor: [0, -Math.round(currentSize[1] / 2)],
                className: 'camera-marker-icon'
              });

              const marker = L.marker([node.y, node.x], { icon: cameraIcon });

              marker.bindTooltip(`<div style="
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                border: 1px solid ${isOnline ? '#52c41a' : '#ff4d4f'};
                min-width: 180px;
              ">
                <div style="margin-bottom: 6px; font-weight: 700; font-size: 14px;">${cameraName}</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                  <span style="color:#aaa;">${t('map.cameraEnable')}:</span>
                  ${boolLabel(enableVal)}
                </div>
                <div style="display:flex; justify-content:space-between; gap:8px;">
                  <span style="color:#aaa; white-space:nowrap;">${t('map.cameraRunningOnClient')}:</span>
                  <span style="color:#fff; word-break:break-all;">${runningVal !== undefined && runningVal !== null && runningVal !== '' ? runningVal : '<span style="color:#999">—</span>'}</span>
                </div>
              </div>`, {
                permanent: false,
                direction: 'top',
                offset: [0, -20],
                className: 'camera-tooltip'
              });

              if (onCameraClick) {
                marker.on('click', () => {
                  onCameraClick({
                    cameraIndex: cameraIndex,
                    cameraName: cameraName,
                    cameraData: raw,
                  });
                });
              }

              // Update size on zoom
              const onZoom = () => {
                const newSize = getCameraIconSizeByZoom(mapInstance);
                const newIcon = L.icon({
                  iconUrl: isOnline ? onlineCameraIcon : offlineCameraIcon,
                  iconSize: newSize,
                  iconAnchor: [Math.round(newSize[0] / 2), Math.round(newSize[1] / 2)],
                  popupAnchor: [0, -Math.round(newSize[1] / 2)],
                  className: 'camera-marker-icon'
                });
                marker.setIcon(newIcon);
              };
              mapInstance.on('zoomend', onZoom);
              marker.on('remove', () => {
                mapInstance && mapInstance.off('zoomend', onZoom);
              });

              camerasLayer.addLayer(marker);

              // Lưu markers vào markersRef để tra cứu
              markersRef.current[node.name] = marker;
              markersRef.current[`Camera${cameraIndex}`] = marker;
              if (cameraName) markersRef.current[cameraName] = marker;
            }
          } catch (nodeError) {
            console.error('Error processing camera node:', node, nodeError);
          }
        });
      }

      // Kiểm tra map container vẫn tồn tại trước khi add layer
      if (mapInstance && mapInstance.getContainer()) {
        camerasLayer.addTo(mapInstance);
        layerRef.current = camerasLayer;
      } else {
        console.warn(' Map container missing, cannot add camera layer');
      }

    } catch (error) {
      console.error('Camera useEffect error:', error);
      // Cleanup on error
      if (layerRef.current && mapInstance) {
        try {
          mapInstance.removeLayer(layerRef.current);
        } catch (cleanupError) {
          console.warn('Error during cleanup:', cleanupError);
        }
        layerRef.current = null;
      }
    }

    // Cleanup function
    return () => {
      if (layerRef.current && mapInstance && mapInstance.getContainer()) {
        try {
          mapInstance.removeLayer(layerRef.current);
        } catch (error) {
          console.warn('Error removing camera layer in cleanup:', error);
        }
        layerRef.current = null;
      }
      markersRef.current = {};
    };
  }, [mapInstance, mapData, showCameras, onCameraClick, cameraState, t]);

  // useEffect để xử lý focus + tooltip khi cameraFilter thay đổi
  useEffect(() => {
    if (!mapInstance || !focusCamera || !markersRef.current) {
      return;
    }

    const query = String(focusCamera).trim();
    if (!query) {
      return;
    }
    // Tìm marker theo nhiều cách
    let targetMarker = null;
    
    // Thử các key khác nhau
    const keysToTry = [
      query,
      `Camera${query}`,
      query.replace(/\s+/g, ''),
      query.toLowerCase()
    ];

    // Tìm marker theo các key
    for (const key of keysToTry) {
      if (markersRef.current[key]) {
        targetMarker = markersRef.current[key];
        break;
      }
    }

    if (targetMarker) {
      // Chỉ mở tooltip, không pan và không highlight
      targetMarker.openTooltip();
    } else {
    }
  }, [focusCamera, mapInstance]);

  // Route change detection và cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Cleanup khi route thay đổi
      if (layerRef.current && mapInstance) {
        try {
          mapInstance.removeLayer(layerRef.current);
          layerRef.current = null;
        } catch (error) {
          console.warn('Error cleaning up on route change:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload(); // Cleanup ngay lập tức
    };
  }, [mapInstance]);

  return null;
};

export default Camera;


