// src/components/Overview/map/camera/CameraDetailsModal.jsx
import React, { useState } from 'react';
import CameraViewer from './CameraViewer';
import CameraViewerWebRTC from './CameraViewerWebRTC';

const ICS_AREA_IDS = new Set([1, 2]);

const ENABLE_CAMERA_URL = 'http://192.168.50.16:6050/monitor-service/api/enable_camera';

/* ─── Reusable overlay ─── */
const Overlay = ({ zIndex = 1100, children }) => (
  <div style={{
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex,
  }}>
    {children}
  </div>
);

/* ─── Dialog xác nhận ─── */
const ConfirmDialog = ({ cameraName, willEnable, onCancel, onConfirm }) => (
  <Overlay zIndex={1200}>
    <div style={{
      background: '#fff', borderRadius: '14px', padding: '28px 28px 22px',
      maxWidth: '360px', width: '90%',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    }}>
      <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '12px' }}>
        {willEnable ? '🔓' : '🔒'}
      </div>
      <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '16px', color: '#111' }}>
        Xác nhận thao tác
      </h3>
      <p style={{ textAlign: 'center', color: '#555', fontSize: '14px', margin: '0 0 22px' }}>
        Bạn muốn{' '}
        <strong style={{ color: willEnable ? '#16a34a' : '#dc2626' }}>
          {willEnable ? 'kích hoạt' : 'vô hiệu hoá'}
        </strong>{' '}
        camera <strong>{cameraName}</strong>?
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '9px 0', borderRadius: '8px',
            border: '1px solid #d1d5db', background: '#f9fafb',
            color: '#374151', cursor: 'pointer', fontSize: '14px',
          }}
        >
          Huỷ
        </button>
        <button
          onClick={onConfirm}
          style={{
            flex: 1, padding: '9px 0', borderRadius: '8px',
            border: 'none', background: willEnable ? '#16a34a' : '#dc2626',
            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 700,
          }}
        >
          Xác nhận
        </button>
      </div>
    </div>
  </Overlay>
);

/* ─── Dialog thành công ─── */
const SuccessDialog = ({ desc, onClose }) => (
  <Overlay zIndex={1200}>
    <div style={{
      background: '#fff', borderRadius: '14px', padding: '28px 28px 22px',
      maxWidth: '340px', width: '90%',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
      <h3 style={{ margin: '0 0 8px', fontSize: '17px', color: '#15803d' }}>Thành công</h3>
      <p style={{ color: '#374151', fontSize: '14px', margin: '0 0 22px', lineHeight: 1.5 }}>
        {desc}
      </p>
      <button
        onClick={onClose}
        style={{
          padding: '9px 32px', borderRadius: '8px', border: 'none',
          background: '#16a34a', color: '#fff', fontSize: '14px',
          fontWeight: 700, cursor: 'pointer', width: '100%',
        }}
      >
        Đóng
      </button>
    </div>
  </Overlay>
);

/* ─── Helper row ─── */
const Row = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
    <span style={{ color: '#555', fontSize: '13px' }}>{label}:</span>
    <span style={{ fontSize: '13px' }}>{children}</span>
  </div>
);

/* ─── Modal chính ─── */
const CameraDetailsModal = ({ selectedCamera, onClose, onRefetch, onOptimisticUpdate, areaId = null }) => {
  const [phase, setPhase] = useState('view'); // 'view' | 'confirm' | 'loading' | 'success' | 'error'
  const [responseDesc, setResponseDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showStream, setShowStream] = useState(false);

  if (!selectedCamera) return null;

  const raw = selectedCamera.cameraData || {};
  const cameraId = raw.id ?? raw.cameraId;
  const cameraName = selectedCamera.cameraName;
  const useWebRTC = ICS_AREA_IDS.has(Number(areaId));
  const isEnabled = raw.enable === true;
  const isOnline = raw.status === 'Connected';
  const willEnable = !isEnabled;

  const handleActionClick = () => {
    setErrorMsg('');
    setPhase('confirm');
  };

  const handleConfirmed = async () => {
    setPhase('loading');
    const payload = { id: Number(cameraId), enable: willEnable };
    try {
      const res = await fetch(ENABLE_CAMERA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.code === 1000) {
        if (onOptimisticUpdate && cameraId != null) {
          onOptimisticUpdate(cameraId, { enable: willEnable });
        }
        setResponseDesc(json.desc ?? 'Thao tác thành công');
        setPhase('success');
      } else {
        throw new Error(json.desc ?? `Code không hợp lệ: ${json.code}`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi kết nối');
      setPhase('error');
    }
  };

  const handleSuccessClose = () => {
    if (onRefetch) onRefetch();
    onClose();
  };

  const isLoading = phase === 'loading';

  return (
    <>
      {/* ── Main modal ── */}
      <Overlay zIndex={1000}>
        <div style={{
          backgroundColor: '#fff2e6',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          maxWidth: '400px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '22px' }}>{isOnline ? '📷' : '📵'}</span>
            <h3 style={{ margin: 0, color: '#000', fontSize: '16px', fontWeight: 700 }}>
              {cameraName}
            </h3>
            <span style={{
              marginLeft: 'auto', padding: '2px 10px', borderRadius: '12px', fontSize: '12px',
              fontWeight: 600,
              background: isOnline ? '#dcfce7' : '#fee2e2',
              color: isOnline ? '#15803d' : '#dc2626',
            }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Camera info block */}
          <div style={{
            marginBottom: '16px', padding: '12px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontWeight: 600, color: '#000', marginBottom: '8px', fontSize: '13px' }}>
              Thông tin camera
            </div>
            {cameraId != null && (
              <Row label="ID">
                <span style={{ fontFamily: 'monospace', color: '#000' }}>{cameraId}</span>
              </Row>
            )}
            <Row label="Kích hoạt">
              <span style={{ fontWeight: 600, color: isEnabled ? '#16a34a' : '#dc2626' }}>
                {isEnabled ? '✓ Có' : '✗ Không'}
              </span>
            </Row>
            {raw.running_on_client !== undefined && raw.running_on_client !== null && (
              <Row label="Running on client">
                <span style={{ color: '#000', wordBreak: 'break-all', maxWidth: '180px', textAlign: 'right' }}>
                  {String(raw.running_on_client)}
                </span>
              </Row>
            )}
            {raw.updated_at && (
              <Row label="Cập nhật lúc">
                <span style={{ color: '#555', fontSize: '12px' }}>
                  {new Date(raw.updated_at).toLocaleString('vi-VN')}
                </span>
              </Row>
            )}
          </div>

          {/* Error inline */}
          {phase === 'error' && errorMsg && (
            <div style={{
              marginBottom: '12px', padding: '10px 14px', borderRadius: '8px',
              background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626',
              fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span>⚠️</span>{errorMsg}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: '6px',
                backgroundColor: '#000', color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              Đóng
            </button>
            <button
              onClick={() => setShowStream(true)}
              disabled={isLoading}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: '6px',
                backgroundColor: '#1d4ed8', color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              📺 Xem stream
            </button>
            <button
              onClick={handleActionClick}
              disabled={isLoading || phase === 'confirm'}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: '6px',
                backgroundColor: isEnabled ? '#dc2626' : '#16a34a',
                color: '#fff',
                cursor: (isLoading || phase === 'confirm') ? 'not-allowed' : 'pointer',
                opacity: (isLoading || phase === 'confirm') ? 0.7 : 1,
                fontWeight: 600,
              }}
            >
              {isLoading ? '⏳ Đang xử lý...' : isEnabled ? '🔒 Vô hiệu hoá' : '🔓 Kích hoạt'}
            </button>
          </div>
        </div>
      </Overlay>

      {/* ── Stream viewer ── */}
      {showStream && useWebRTC && (
        <CameraViewerWebRTC
          cameraId={cameraId}
          cameraName={cameraName}
          onClose={() => setShowStream(false)}
        />
      )}
      {showStream && !useWebRTC && (
        <CameraViewer
          cameraData={selectedCamera}
          onClose={() => setShowStream(false)}
        />
      )}

      {/* ── Confirm dialog ── */}
      {phase === 'confirm' && (
        <ConfirmDialog
          cameraName={cameraName}
          willEnable={willEnable}
          onCancel={() => setPhase('view')}
          onConfirm={handleConfirmed}
        />
      )}

      {/* ── Success dialog ── */}
      {phase === 'success' && (
        <SuccessDialog
          desc={responseDesc}
          onClose={handleSuccessClose}
        />
      )}
    </>
  );
};

export default CameraDetailsModal;
