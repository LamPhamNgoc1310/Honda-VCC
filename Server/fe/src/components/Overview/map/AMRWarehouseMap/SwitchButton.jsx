import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { toast } from 'sonner';
import { useArea } from '@/contexts/AreaContext';
import { setAIMode } from '@/services/mapService';

const ALLOWED_AREA_IDS = [1, 2];
const AREA_ENABLE_URL = 'http://192.168.50.16:6050/monitor-service/api/area_enable/set';

/* ------------------------------------------------------------------ */
/*  Modal xác nhận — render ra document.body qua Portal (z-index cao) */
/* ------------------------------------------------------------------ */
const ConfirmModal = ({ enable, areaName, onConfirm, onCancel }) =>
  ReactDOM.createPortal(
    <>
      {/* Overlay che toàn bộ màn hình */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Hộp dialog */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 99999,
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          background: 'rgba(14, 24, 56, 0.97)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 16,
          padding: '28px 28px 24px',
          color: '#e0f2fe',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Tiêu đề */}
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#e0f2fe' }}>
          Xác nhận thao tác
        </h3>

        {/* Nội dung */}
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.7, color: '#cbd5e1' }}>
          Bạn có chắc chắn muốn{' '}
          <b style={{ color: enable ? '#10b981' : '#ef4444' }}>
            {enable ? 'BẬT' : 'TẮT'}
          </b>{' '}
          chế độ AI cho khu vực{' '}
          <b style={{ color: '#22BDBD' }}>{areaName}</b>?
        </p>

        {/* Info box: API + payload */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#94a3b8',
            lineHeight: 1.8,
            wordBreak: 'break-all',
            marginBottom: 24,
          }}
        >
          <div><span style={{ color: '#475569' }}>API:&nbsp;</span>{AREA_ENABLE_URL}</div>
          <div style={{ marginTop: 2 }}>
            <span style={{ color: '#475569' }}>Payload:&nbsp;</span>
            {JSON.stringify({ area_name: areaName, enable })}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            className="neon-btn"
            style={{ padding: '8px 22px', fontSize: '13px' }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`neon-btn ${enable ? 'green' : 'red'}`}
            style={{ padding: '8px 22px', fontSize: '13px' }}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </>,
    document.body
  );

/* ------------------------------------------------------------------ */
/*  Component chính                                                     */
/* ------------------------------------------------------------------ */
const AIControlButtons = () => {
  const { currAreaId, areaData } = useArea();
  const [aiEnabled, setAiEnabled] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // null | true | false

  const isAllowed = ALLOWED_AREA_IDS.includes(Number(currAreaId));
  const currentArea = areaData?.find((a) => a.area_id === currAreaId);
  const areaName = currentArea?.area_name ?? '';

  const openConfirm = (enable) => {
    if (loading || aiEnabled === enable || !isAllowed) return;
    setConfirmAction(enable);
  };

  const handleConfirm = async () => {
    const enable = confirmAction;
    setConfirmAction(null);
    setLoading(true);

    const payload = { area_name: areaName, enable };
    console.log(`[AIControl] 📡 Gửi lên API: ${AREA_ENABLE_URL}`);
    console.log(`[AIControl] 📦 Payload:`, payload);

    try {
      const result = await setAIMode(areaName, enable);
      const code = result?.data?.code;

      if (code === 1000) {
        setAiEnabled(enable);
        toast.success(`${enable ? 'Bật' : 'Tắt'} AI thành công`, {
          description: 'Hệ thống đã nhận lệnh.',
        });
      } else {
        toast.error('Không thành công', {
          description: (
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              <div><b>Code trả về:</b> {String(code ?? 'N/A')}</div>
              <div><b>Payload gửi:</b> {JSON.stringify(result.payload)}</div>
              <div><b>Response:</b> {JSON.stringify(result.data)}</div>
            </div>
          ),
          duration: 8000,
        });
      }
    } catch (err) {
      toast.error('Lỗi kết nối đến server', {
        description: (
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            <div><b>Lỗi:</b> {err.message ?? 'Unknown error'}</div>
            <div><b>Payload gửi:</b> {JSON.stringify(err.payload)}</div>
            {err.data && <div><b>Response:</b> {JSON.stringify(err.data)}</div>}
          </div>
        ),
        duration: 8000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAllowed) return null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => openConfirm(true)}
          disabled={loading || aiEnabled === true}
          className={`neon-btn green ${aiEnabled === true ? 'neon-active' : ''}`}
          style={{ padding: '8px 20px', fontSize: '13px' }}
          title={`Bật AI cho ${areaName}`}
        >
          {loading ? '...' : 'Bật AI'}
        </button>

        <button
          type="button"
          onClick={() => openConfirm(false)}
          disabled={loading || aiEnabled === false}
          className={`neon-btn red ${aiEnabled === false ? 'neon-active' : ''}`}
          style={{ padding: '8px 20px', fontSize: '13px' }}
          title={`Tắt AI cho ${areaName}`}
        >
          {loading ? '...' : 'Tắt AI'}
        </button>
      </div>

      {confirmAction !== null && (
        <ConfirmModal
          enable={confirmAction}
          areaName={areaName}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
};

export default AIControlButtons;
