// src/components/Overview/map/AMRWarehouseMap/NodeDetailsModal.jsx
import React, { useState } from 'react';

const ENABLE_POSITION_URL = 'http://192.168.50.16:6050/monitor-service/api/enable_position';

/* ─── Reusable overlay wrapper ─── */
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

/* ─── Dialog xác nhận (tách rời) ─── */
const ConfirmDialog = ({ nodeName, willEnable, onCancel, onConfirm }) => (
  <Overlay zIndex={1200}>
    <div style={{
      background: '#fff',
      borderRadius: '14px',
      padding: '28px 28px 22px',
      maxWidth: '360px',
      width: '90%',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    }}>
      <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '12px' }}>
        {willEnable ? '🔓' : '🔒'}
      </div>
      <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '16px', color: '#111' }}>
        Xác nhận thao tác
      </h3>
      <p style={{ textAlign: 'center', color: '#555', fontSize: '14px', margin: '0 0 22px' }}>
        Bạn muốn <strong style={{ color: willEnable ? '#16a34a' : '#dc2626' }}>
          {willEnable ? 'kích hoạt' : 'vô hiệu hoá'}
        </strong> điểm <strong>{nodeName}</strong>?
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

/* ─── Dialog thành công (tách rời) ─── */
const SuccessDialog = ({ desc, onClose }) => (
  <Overlay zIndex={1200}>
    <div style={{
      background: '#fff',
      borderRadius: '14px',
      padding: '28px 28px 22px',
      maxWidth: '340px',
      width: '90%',
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

/* ─── Modal chính ─── */
const NodeDetailsModal = ({ selectedNode, onClose, onToggleLock, onRefetch, onOptimisticUpdate }) => {
  const [phase, setPhase] = useState('view'); // 'view' | 'confirm' | 'loading' | 'success' | 'error'
  const [responseDesc, setResponseDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!selectedNode) return null;

  const hasSCM = !!(selectedNode.scmData?.positionID);
  const willEnable = hasSCM ? !selectedNode.scmData.enable : null;
  const actionLabel = hasSCM
    ? (selectedNode.scmData.enable ? '🔒 Vô hiệu hoá' : '🔓 Kích hoạt')
    : (selectedNode.isLocked ? 'Mở khóa' : 'Khóa điểm');

  /* Nhấn nút hành động → mở confirm dialog */
  const handleActionClick = () => {
    if (!hasSCM) { onToggleLock(selectedNode.id); return; }
    setErrorMsg('');
    setPhase('confirm');
  };

  /* Xác nhận → gọi API */
  const handleConfirmed = async () => {
    setPhase('loading');

    const payload = {
      id: Number(selectedNode.scmData.positionID),
      enable: willEnable,
    };

    try {
      const res = await fetch(ENABLE_POSITION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.code === 1000) {
        // Cập nhật ngay icon node trên map mà không cần chờ refetch đầy đủ
        if (onOptimisticUpdate && selectedNode.scmData?.positionID) {
          onOptimisticUpdate(selectedNode.scmData.positionID, { enable: willEnable });
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

  /* Đóng success → refetch trạng thái điểm + đóng tất cả modal */
  const handleSuccessClose = () => {
    if (onRefetch) onRefetch();   // fetch lại API position status để cập nhật icon trên map
    onClose();                    // đóng main modal
  };

  const isLoading = phase === 'loading';

  return (
    <>
      {/* ── Main modal ── */}
      <Overlay zIndex={1000}>
        <div
          className="backdrop-blur-sm"
          style={{
            backgroundColor: '#fff2e6',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            maxWidth: '400px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', color: '#000' }}>
            Chi tiết điểm: {selectedNode.name}
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <strong className="text-black">Loại điểm:</strong>
            <span style={{ marginLeft: '8px', padding: '4px 8px', borderRadius: '4px',
              color: selectedNode.type === 'supply' ? '#000' : '#fa8c16' }}>
              {selectedNode.type === 'supply' ? 'Điểm cấp'
                : selectedNode.type === 'return' ? 'Điểm trả' : 'Điểm thường'}
            </span>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'black' }}>Vị trí:</strong>{' '}
            <span style={{ color: 'black' }}>{selectedNode.nodeData.key}</span>
          </div>

          {/* SCM data block */}
          {selectedNode.scmData && (
            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px',
              background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)' }}>
              <div style={{ fontWeight: 600, color: '#000', marginBottom: '8px', fontSize: '13px' }}>
                Thông tin SCM
              </div>
              <Row label="Kích hoạt">
                <span style={{ fontWeight: 600,
                  color: selectedNode.scmData.enable ? '#16a34a' : '#dc2626' }}>
                  {selectedNode.scmData.enable ? '✓ Có' : '✗ Không'}
                </span>
              </Row>
              <Row label="Kệ hàng">
                <span style={{ fontWeight: 600,
                  color: selectedNode.scmData.shelf === 'Empty' ? '#dc2626' : '#16a34a' }}>
                  {selectedNode.scmData.shelf === 'Empty' ? 'Trống' : (selectedNode.scmData.shelf ?? '—')}
                </span>
              </Row>
              <Row label="Trạng thái">
                <span style={{ color: '#000' }}>{selectedNode.scmData.state ?? '—'}</span>
              </Row>
              {selectedNode.scmData.positionID && (
                <Row label="Position ID">
                  <span style={{ fontFamily: 'monospace', color: '#000' }}>
                    {selectedNode.scmData.positionID}
                  </span>
                </Row>
              )}
            </div>
          )}

          {/* Lỗi inline (sau khi đóng error dialog) */}
          {phase === 'error' && errorMsg && (
            <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px',
              background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626',
              fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span>{errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{ padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: '6px',
                backgroundColor: 'black', color: 'white',
                cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}
            >
              Đóng
            </button>
            {hasSCM && (
              <button
                onClick={handleActionClick}
                disabled={isLoading || phase === 'confirm'}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', minWidth: '120px',
                  backgroundColor: selectedNode.scmData.enable ? '#ff4d4f' : '#52c41a',
                  color: 'white',
                  cursor: (isLoading || phase === 'confirm') ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || phase === 'confirm') ? 0.7 : 1 }}
              >
                {isLoading ? '⏳ Đang xử lý...' : actionLabel}
              </button>
            )}
          </div>
        </div>
      </Overlay>

      {/* ── Confirm dialog (tách rời) ── */}
      {phase === 'confirm' && (
        <ConfirmDialog
          nodeName={selectedNode.name}
          willEnable={willEnable}
          onCancel={() => setPhase('view')}
          onConfirm={handleConfirmed}
        />
      )}

      {/* ── Success dialog (tách rời) ── */}
      {phase === 'success' && (
        <SuccessDialog
          desc={responseDesc}
          onClose={handleSuccessClose}
        />
      )}
    </>
  );
};

/* ── Helper row ── */
const Row = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
    <span style={{ color: '#555', fontSize: '13px' }}>{label}:</span>
    <span style={{ fontSize: '13px' }}>{children}</span>
  </div>
);

export default NodeDetailsModal;
