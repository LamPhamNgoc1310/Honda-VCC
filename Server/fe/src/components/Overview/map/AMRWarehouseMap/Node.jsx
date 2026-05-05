import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Tạo icon SVG cho điểm cấp / điểm trả.
 * - shelf = null  : emoji to, nền trong suốt, opacity 100%
 * - shelf = 'Empty': emoji mờ (opacity 38%)
 * - shelf = khác  : emoji sáng 100%
 * Không viền, không badge.
 */
const buildNodeIcon = (emoji, shelf, W = 48) => {
  const isEmpty = shelf === 'Empty';
  const opacity = isEmpty ? 0.38 : 1;
  const cx = W / 2;
  const cy = W / 2;

  const svg = `<svg width="${W}" height="${W}" viewBox="0 0 ${W} ${W}"
  xmlns="http://www.w3.org/2000/svg" opacity="${opacity}">
  <text x="${cx}" y="${cy + W * 0.23}" text-anchor="middle"
        font-size="${Math.round(W * 0.70)}" dominant-baseline="auto">${emoji}</text>
</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

// enable: true/null = icon bình thường | false = khoá
const createSupplyPointIcon = (enable, shelf, W) =>
  buildNodeIcon(enable === false ? '🔒' : '📦', shelf, W);

const createReturnPointIcon = (enable, shelf, W) =>
  buildNodeIcon(enable === false ? '🔒' : '↩️', shelf, W);

// Kích thước icon node theo zoom — base to hơn, min 44px
const getNodeIconSizeByZoom = (zoom, base = 44, min = 44, max = 80) =>
  Math.max(min, Math.min(max, Math.round(base * Math.pow(2, zoom))));

const NodeComponent = ({ 
  mapInstance, 
  mapData, 
  onNodeClick,
  showNodes = true,
  nodeFilter = '',
  mapZoom = 0,
  positionStatus = {},
}) => {
  const { t } = useTranslation();
  const nodesLayerRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapInstance || !mapData || !showNodes) {
      // Remove existing layer if exists
      if (nodesLayerRef.current) {
        mapInstance.removeLayer(nodesLayerRef.current);
        nodesLayerRef.current = null;
      }
      return;
    }


    const nodeIconSize = getNodeIconSizeByZoom(mapZoom);
    const nodeIconAnchor = nodeIconSize / 2;

    // Create new layer
    const nodesLayer = L.layerGroup();
    markersRef.current = {};
    if (mapData.nodeArr) {
      let processedCount = 0;
      
      mapData.nodeArr.forEach((node, index) => {
        // Determine node type and create appropriate icon
        let nodeIcon;
        let nodeType = 'unknown';
        let derivedId = null;

        // Guard: must have coordinates
        if (node == null || typeof node.x === 'undefined' || typeof node.y === 'undefined') {
          return;
        }

        // Lọc theo nodeFilter: tìm theo node.name hoặc node.key
        const filterTrim = (nodeFilter || '').trim();
        if (filterTrim) {
          const q = filterTrim.toUpperCase();
          const nameMatch = typeof node.name === 'string' && node.name.toUpperCase().includes(q);
          const keyMatch = node.key != null && String(node.key).toUpperCase().includes(q);
          if (!nameMatch && !keyMatch) return;
        }

        // Tra cứu SCM position status theo node.key — nguồn duy nhất cho icon
        const scmPos = positionStatus[String(node.key)] ?? null;
        const shelf = scmPos?.shelf ?? null;
        const enable = scmPos?.enable ?? null; // null = không có data SCM

        const makeIcon = (iconUrl, className) => L.icon({
          iconUrl,
          iconSize: [nodeIconSize, nodeIconSize],
          iconAnchor: [nodeIconAnchor, nodeIconAnchor],
          popupAnchor: [0, -nodeIconAnchor],
          className,
        });

        // Check if it's a supply point (điểm cấp): theo name DiemC hoặc node.type === 1
        if (typeof node.name === 'string' && /^DiemC\d+$/i.test(node.name.trim())) {
          derivedId = parseInt(node.name.replace(/DiemC/i, ''));
          nodeIcon = makeIcon(createSupplyPointIcon(enable, shelf, nodeIconSize), 'supply-point-icon');
          nodeType = 'supply';
        }
        // Check if it's a return point (điểm trả): theo name DiemT hoặc name chứa "XT"
        else if (typeof node.name === 'string' && /^DiemT\d+$/i.test(node.name.trim())) {
          derivedId = parseInt(node.name.replace(/DiemT/i, ''));
          nodeIcon = makeIcon(createReturnPointIcon(enable, shelf, nodeIconSize), 'return-point-icon');
          nodeType = 'return';
        }
        else if (typeof node.name === 'string' && node.name.toUpperCase().includes('XT')) {
          derivedId = node.key ?? node.id ?? index;
          nodeIcon = makeIcon(createReturnPointIcon(enable, shelf, nodeIconSize), 'return-point-icon');
          nodeType = 'return';
        }
        // Theo node.type: 1 = supply, 2 = return
        else if (Number(node.type) === 1) {
          derivedId = node.key ?? node.id ?? index;
          nodeIcon = makeIcon(createSupplyPointIcon(enable, shelf, nodeIconSize), 'supply-point-icon');
          nodeType = 'supply';
        }
        else if (Number(node.type) === 2) {
          derivedId = node.key ?? node.id ?? index;
          nodeIcon = makeIcon(createReturnPointIcon(enable, shelf, nodeIconSize), 'return-point-icon');
          nodeType = 'return';
        }

        // Only render markers for supply/return; skip others
        if (!nodeIcon) {
          return;
        }

        // Create marker
        const marker = L.marker([node.y, node.x], { icon: nodeIcon });

        // Tooltip — chỉ dùng data từ SCM API
        const typeLabel = nodeType === 'supply' ? t('map.nodeTypeSupply') : t('map.nodeTypeReturn');

        // Màu border theo SCM data
        const borderColor = enable === false
          ? '#ff6b6b'
          : shelf === 'Empty'
            ? '#555'
            : scmPos
              ? '#52c41a'
              : (nodeType === 'supply' ? '#52c41a' : '#ff4d4f');

        const scmRows = scmPos ? `
          <div style="margin-top:5px; padding-top:5px; border-top:1px solid rgba(255,255,255,0.15);">
            <div style="font-size:11px; display:flex; justify-content:space-between; margin-bottom:2px;">
              <span style="color:#aaa;">${t('map.scmShelf')}:</span>
              <span style="color:${shelf === 'Empty' ? '#ff4d4f' : '#52c41a'}; font-weight:600;">${scmPos.shelf ?? '—'}</span>
            </div>
            <div style="font-size:11px; display:flex; justify-content:space-between; margin-bottom:2px;">
              <span style="color:#aaa;">${t('map.scmState')}:</span>
              <span style="color:#fff;">${scmPos.state ?? '—'}</span>
            </div>
            <div style="font-size:11px; display:flex; justify-content:space-between;">
              <span style="color:#aaa;">${t('map.scmEnable')}:</span>
              <span style="color:${enable ? '#52c41a' : '#ff4d4f'};">${enable ? t('map.boolYes') : t('map.boolNo')}</span>
            </div>
          </div>` : '';

        const tooltipContent = `
          <div style="
            background: rgba(0,0,0,0.9); color:white; padding:8px 12px;
            border-radius:6px; font-size:13px; font-weight:500;
            box-shadow:0 2px 8px rgba(0,0,0,0.3);
            border:1px solid ${borderColor}; min-width:150px;">
            <div style="margin-bottom:4px; font-weight:600; display:flex; align-items:center; gap:6px;">
              <span style="width:8px; height:8px; border-radius:50%; background:${borderColor}; display:inline-block;"></span>
              ${node.name || `Node ${node.key || 'Unknown'}`}
            </div>
            <div style="font-size:11px; opacity:0.9; margin-bottom:2px;">
              ${t('map.nodeTypeLabel')} ${typeLabel}
            </div>
            ${scmRows}
            <div style="font-size:10px; opacity:0.7; margin-top:4px;">
              ${t('map.clickForDetails')}
            </div>
          </div>
        `;

        // Bind tooltip
        marker.bindTooltip(tooltipContent, {
          permanent: false,
          direction: 'top',
          offset: [0, -20],
          className: 'node-tooltip'
        });

        // Add click event
        marker.on('click', () => {
          const nodeInfo = {
            id: derivedId ?? node.key ?? node.id,
            name: node.name,
            type: nodeType,
            position: { x: node.x, y: node.y },
            nodeData: node,
            scmData: scmPos ?? null,
          };

          console.log('Node clicked:', nodeInfo);
          
          if (onNodeClick) {
            onNodeClick(nodeInfo);
          }
        });

        nodesLayer.addLayer(marker);
        const markerKey = node.name ?? String(node.key ?? node.id ?? index);
        markersRef.current[markerKey] = marker;
        if (node.key != null) markersRef.current[String(node.key)] = marker;
        processedCount++;
      });
    }

    // Add layer to map (ensure map panes are ready)
    try {
      const openFirstTooltip = () => {
        const trimFilter = (nodeFilter || '').trim();
        if (!trimFilter || !markersRef.current) return;
        const keys = Object.keys(markersRef.current);
        if (keys.length > 0 && markersRef.current[keys[0]]) {
          try {
            markersRef.current[keys[0]].openTooltip();
          } catch (err) {
            console.warn('[NodeComponent] openTooltip failed:', err);
          }
        }
      };
      if (typeof mapInstance.whenReady === 'function') {
        mapInstance.whenReady(() => {
          try {
            nodesLayer.addTo(mapInstance);
            nodesLayerRef.current = nodesLayer;
            setTimeout(openFirstTooltip, 80);
          } catch (err) {
            console.error('[NodeComponent] Failed to add nodes layer (whenReady):', err);
          }
        });
      } else {
        nodesLayer.addTo(mapInstance);
        nodesLayerRef.current = nodesLayer;
        setTimeout(openFirstTooltip, 80);
      }
    } catch (e) {
      console.error('[NodeComponent] Error adding nodes layer:', e);
    }
    // Cleanup function
    return () => {
      if (nodesLayerRef.current) {
        mapInstance.removeLayer(nodesLayerRef.current);
        nodesLayerRef.current = null;
      }
      markersRef.current = {};
    };
  }, [mapInstance, mapData, onNodeClick, showNodes, nodeFilter, mapZoom, t, positionStatus]);

  return null; // This component doesn't render anything visible
};

export default NodeComponent;