
import React, { useState } from 'react';
import { Input, AutoComplete, Checkbox } from 'antd';
import { useTranslation } from 'react-i18next';

const MapFilters = ({
  cameraFilter,
  setCameraFilter,
  nodeFilter,
  setNodeFilter,
  showNodes,
  setShowNodes,
  showCameras,
  setShowCameras,
  showRobots,
  setShowRobots,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const options = [];

  const handleSelect = (value) => {
    setCameraFilter(value);
    setOpen(false); // Đóng dropdown sau khi chọn
  };

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 12, border: '1px #333', borderRadius: 10, boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.1)', padding: 10 }}>
     {/* Filter Camera ID */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'white' }}>
        <span style={{ fontWeight: 500 }}>{t('map.cameraId')}:</span>
        <AutoComplete
          value={cameraFilter || ''}
          options={options}
          open={open}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(val) => {
            setCameraFilter(val);
          }}
          onSelect={handleSelect}
          style={{ width: 220 }}
        >
        <Input
          placeholder={t('map.enterCameraId')}
          value={cameraFilter || ''}
          onChange={(e) => {
            setCameraFilter(e.target.value);
          }}
          style={{ width: 120}}
          allowClear
          size="middle"
        />
        </AutoComplete>
      </div>
      {/* Tìm điểm theo node.name hoặc node.key */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'white' }}>
        <span style={{ fontWeight: 500 }}>{t('map.findPoint')}</span>
        <Input
          placeholder={t('map.placeholderFindNode')}
          value={nodeFilter || ''}
          onChange={(e) => setNodeFilter(e.target.value)}
          style={{ width: 160 }}
          allowClear
          size="middle"
        />
      </div>
      {/* Hiển thị: điểm / camera / robot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'white' }}>
        <span style={{ fontWeight: 500 }}>{t('map.display')}</span>
        <Checkbox
          checked={showNodes}
          onChange={(e) => setShowNodes(e.target.checked)}
          style={{ color: 'white' }}
        >
          {t('map.showPoints')}
        </Checkbox>
        <Checkbox
          checked={showCameras}
          onChange={(e) => setShowCameras(e.target.checked)}
          style={{ color: 'white' }}
        >
          {t('map.showCamera')}
        </Checkbox>
        <Checkbox
          checked={showRobots}
          onChange={(e) => setShowRobots(e.target.checked)}
          style={{ color: 'white' }}
        >
          {t('map.showRobot')}
        </Checkbox>
      </div>
    </div>
  );
};

export default MapFilters;