import React, { useState, useEffect, useRef, useCallback } from 'react';

const STREAM_CAMERA_URL = 'http://192.168.50.16:6050/monitor-service/api/stream_camera/';

const callStreamAPI = async (cameraId, state) => {
  const payload = { id: Number(cameraId), state };
  console.log(`[CameraViewerWebRTC] → POST ${STREAM_CAMERA_URL}`, JSON.stringify(payload, null, 2));

  const res = await fetch(STREAM_CAMERA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`stream_camera API lỗi: HTTP ${res.status}`);

  const json = await res.json();
  console.log(`[CameraViewerWebRTC] ← Response stream_camera (state=${state}):`, JSON.stringify(json, null, 2));
  return json;
};

const CameraViewerWebRTC = ({ cameraId, cameraName, onClose }) => {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'waiting' | 'webrtc' | 'playing' | 'error'
  const [statusText, setStatusText] = useState('Đang gọi API khởi động stream...');
  const [errorMsg, setErrorMsg] = useState('');
  const [streamUrl, setStreamUrl] = useState(null);
  const [overlayText, setOverlayText] = useState('');

  const isMountedRef = useRef(true);
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const animFrameRef = useRef(null);
  // true sau khi nhận response state:true thành công
  const streamStartedRef = useRef(false);
  // true sau khi đã gọi state:false (dù từ nút X hay unmount) → ngăn gọi lặp lần 2
  const closedRef = useRef(false);

  const stopWebRTC = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track && s.track.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startOverlayUpdate = useCallback(() => {
    const update = () => {
      if (!videoRef.current?.srcObject || !isMountedRef.current) return;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const w = videoRef.current.videoWidth || 0;
      const h = videoRef.current.videoHeight || 0;
      setOverlayText(`${hh}:${mm}:${ss}  ${w}×${h}`);
      animFrameRef.current = requestAnimationFrame(update);
    };
    update();
  }, []);

  // Khởi tạo WebRTC: tạo offer → POST đến offerUrl → nhận answer → setRemoteDescription
  const startWebRTC = useCallback(async (offerUrl) => {
    if (!isMountedRef.current) return;

    console.log(`[CameraViewerWebRTC] Khởi tạo RTCPeerConnection, gửi offer đến: ${offerUrl}`);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.addTransceiver('video', { direction: 'recvonly' });

    pc.ontrack = (event) => {
      if (!isMountedRef.current || !videoRef.current) return;
      console.log('[CameraViewerWebRTC] ✅ Nhận được remote stream');
      videoRef.current.srcObject = event.streams[0];
      videoRef.current.play().catch(() => {});
      videoRef.current.addEventListener(
        'loadeddata',
        () => {
          if (!isMountedRef.current) return;
          console.log(`[CameraViewerWebRTC] 🎥 Video loaded: ${videoRef.current.videoWidth}×${videoRef.current.videoHeight}`);
          setStatus('playing');
          startOverlayUpdate();
        },
        { once: true }
      );
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[CameraViewerWebRTC] ICE state: ${pc.iceConnectionState}`);
      if (!isMountedRef.current) return;
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setStatus('error');
        setErrorMsg('Mất kết nối WebRTC');
      }
    };

    // Tạo SDP offer
    const offer = await pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: false,
    });
    await pc.setLocalDescription(offer);

    if (!isMountedRef.current) return;

    // POST offer (SDP) lên offerUrl — method phải là POST
    console.log(`[CameraViewerWebRTC] → POST SDP offer đến ${offerUrl}`);
    const res = await fetch(offerUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pc.localDescription),
    });
    if (!res.ok) throw new Error(`Streamer lỗi: HTTP ${res.status}`);

    const answer = await res.json();
    console.log('[CameraViewerWebRTC] ← WebRTC answer nhận được:', answer);

    if (!isMountedRef.current) return;
    await pc.setRemoteDescription(answer);
    console.log('[CameraViewerWebRTC] WebRTC kết nối xong, đang chờ frame...');
  }, [startOverlayUpdate]);

  useEffect(() => {
    isMountedRef.current = true;
    streamStartedRef.current = false;
    closedRef.current = false;

    const start = async () => {
      try {
        // Bước 1: gọi API bật stream, chờ response
        const json = await callStreamAPI(cameraId, true);

        // Nếu component đã unmount trước khi response về → không làm gì thêm
        if (!isMountedRef.current) return;

        // Đánh dấu: đã nhận response state:true thành công
        streamStartedRef.current = true;

        const offerUrl = json?.data?.url;
        if (!offerUrl) throw new Error(`Không có URL trong response: ${JSON.stringify(json)}`);

        console.log(`[CameraViewerWebRTC] Offer URL: ${offerUrl}`);
        setStreamUrl(offerUrl);

        // Bước 2: đợi 2 giây để backend chuẩn bị sẵn sàng
        setStatus('waiting');
        setStatusText('Đang chờ backend chuẩn bị stream (2s)...');
        console.log('[CameraViewerWebRTC] Chờ 2 giây...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!isMountedRef.current) return;

        // Bước 3: kết nối WebRTC với offerUrl
        setStatus('webrtc');
        setStatusText('Đang thiết lập kết nối WebRTC...');
        await startWebRTC(offerUrl);
      } catch (err) {
        if (!isMountedRef.current) return;
        console.error('[CameraViewerWebRTC] Lỗi:', err);
        setStatus('error');
        setErrorMsg(err.message || 'Không thể khởi động stream');
      }
    };

    start();

    return () => {
      isMountedRef.current = false;
      stopWebRTC();

      if (closedRef.current) {
        console.log('[CameraViewerWebRTC] Cleanup: đã đóng từ nút X trước đó, bỏ qua.');
        return;
      }
      if (!streamStartedRef.current) {
        console.log('[CameraViewerWebRTC] Cleanup: state:true chưa có response → bỏ qua state:false.');
        return;
      }

      // Người dùng thoát trang / đóng modal mà không nhấn nút X
      closedRef.current = true;
      console.log('[CameraViewerWebRTC] Cleanup (navigate away) — gọi API tắt stream');
      callStreamAPI(cameraId, false).catch((err) => {
        console.warn('[CameraViewerWebRTC] Lỗi khi tắt stream (unmount):', err.message);
      });
    };
  }, [cameraId, stopWebRTC, startWebRTC]);

  const handleClose = async () => {
    if (closedRef.current) {
      console.log('[CameraViewerWebRTC] handleClose: đã đóng rồi, bỏ qua.');
      onClose?.();
      return;
    }
    closedRef.current = true;
    streamStartedRef.current = false;
    stopWebRTC();

    console.log('[CameraViewerWebRTC] 🔴 Người dùng nhấn nút đóng — gọi API tắt stream');
    try {
      await callStreamAPI(cameraId, false);
      console.log('[CameraViewerWebRTC] ✅ Stream đã tắt thành công');
    } catch (err) {
      console.warn('[CameraViewerWebRTC] ⚠️ Lỗi khi tắt stream:', err.message);
    }
    onClose?.();
  };

  const isConnecting = status === 'connecting' || status === 'waiting' || status === 'webrtc';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 24,
    }}>
      <div style={{
        background: '#111',
        borderRadius: 12,
        padding: '16px 16px 20px',
        maxWidth: '95vw',
        width: '100%',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
              📷 {cameraName || 'Camera Stream'}
            </span>
            {streamUrl && (
              <span style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {streamUrl}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{
              background: '#dc2626', color: '#fff', border: 'none',
              borderRadius: 6, padding: '6px 16px', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, flexShrink: 0, marginLeft: 12,
            }}
          >
            ✖ Đóng
          </button>
        </div>

        {/* Trạng thái loading */}
        {isConnecting && (
          <div style={{
            color: '#facc15', textAlign: 'center', padding: '32px 0',
            fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <span style={{
              display: 'inline-block', width: 18, height: 18, border: '3px solid #facc15',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            {statusText}
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Trạng thái lỗi */}
        {status === 'error' && (
          <div style={{ color: '#f87171', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>
            ❌ {errorMsg}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={handleClose}
                style={{
                  background: '#374151', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 13,
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* Video WebRTC + overlay timestamp */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              maxWidth: 1280,
              maxHeight: 'calc(95vh - 110px)',
              borderRadius: 8,
              boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
              background: '#000',
              display: status === 'playing' ? 'block' : 'none',
            }}
          />
          {status === 'playing' && overlayText && (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: 'rgba(0,0,0,0.55)',
              color: '#ff4444', fontSize: 13,
              padding: '3px 8px', borderRadius: 4,
              fontFamily: 'monospace', whiteSpace: 'pre',
              pointerEvents: 'none',
            }}>
              {overlayText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraViewerWebRTC;
