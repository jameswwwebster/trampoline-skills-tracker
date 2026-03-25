import axios from 'axios';

const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const shopApi = {
  createOrder: (items) =>
    axios.post(`${API_URL}/booking/shop/orders`, { items }, { headers: getHeaders() }),

  getOrder: (orderId) =>
    axios.get(`${API_URL}/booking/shop/orders/${orderId}`, { headers: getHeaders() }),

  getMyOrders: () =>
    axios.get(`${API_URL}/booking/shop/my-orders`, { headers: getHeaders() }),

  // Admin
  getAdminOrders: (status = 'ALL') =>
    axios.get(`${API_URL}/booking/shop/admin/orders`, { params: { status }, headers: getHeaders() }),

  updateOrderStatus: (orderId, status) =>
    axios.patch(`${API_URL}/booking/shop/admin/orders/${orderId}/status`, { status }, { headers: getHeaders() }),

  getPendingOrderCount: () =>
    axios.get(`${API_URL}/booking/shop/admin/orders/pending-count`, { headers: getHeaders() }),
};
