import api from './api';

/**
 * Gọi API /vcc/possible-targets để tìm điểm đến gần nhất còn trống.
 *
 * @param {number} startPoint - Điểm xuất phát (QR code integer)
 * @param {string} moveMode   - Chế độ di chuyển, mặc định "to_rack"
 * @param {Object} metadata   - Thông tin hàng hóa (6 trường từ form)
 * @returns {Promise<Object>} - { message, nearest_point, selected_zone? }
 */
export const getPossibleTargets = async (startPoint, moveMode = 'to_rack', metadata = {}) => {
  const response = await api.post('/vcc/possible-targets', {
    body: { start_point: startPoint, move_mode: moveMode },
    metadata,
  });
  return response.data;
};

/**
 * Gọi API GET /vcc/cancel_choosing để giải phóng điểm đã lock.
 *
 * @param {number} start    - Điểm xuất phát đã lock
 * @param {number} target   - Điểm đến đã lock
 * @param {string} moveMode - Chế độ di chuyển (tạm để trống, sẽ cập nhật sau)
 * @returns {Promise<Object>}
 */
export const cancelChoosing = async (start, target, moveMode = '') => {
  const response = await api.get('/vcc/cancel_choosing', {
    params: { start, target, move_mode: moveMode },
  });
  return response.data;
};

/**
 * Gọi API POST /vcc/move-to-point để gửi lệnh di chuyển AMR.
 *
 * @param {number} startPoint  - Điểm xuất phát
 * @param {number} targetPoint - Điểm đến
 * @param {string} moveMode    - Chế độ di chuyển (tạm để trống, sẽ cập nhật sau)
 * @param {Object} metadata    - Thông tin hàng hóa từ form
 * @returns {Promise<Object>}
 */
export const moveToPointVcc = async (startPoint, targetPoint, moveMode = '', metadata = {}) => {
  const response = await api.post('/vcc/move-to-point', {
    body: { start_point: startPoint, target_point: targetPoint, move_mode: moveMode },
    metadata,
  });
  return response.data;
};
