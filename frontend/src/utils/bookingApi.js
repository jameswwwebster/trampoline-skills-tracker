import axios from 'axios';

const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const bookingApi = {
  getBookableGymnasts: () =>
    axios.get(`${API_URL}/gymnasts/bookable-for-me`, { headers: getHeaders() }),

  createSelfGymnast: () =>
    axios.post(`${API_URL}/gymnasts/self`, {}, { headers: getHeaders() }),

  addChild: (data) =>
    axios.post(`${API_URL}/gymnasts/add-child`, data, { headers: getHeaders() }),

  getSessions: (year, month) =>
    axios.get(`${API_URL}/booking/sessions`, {
      params: { year, month },
      headers: getHeaders(),
    }),

  getSession: (instanceId) =>
    axios.get(`${API_URL}/booking/sessions/${instanceId}`, { headers: getHeaders() }),

  createBooking: (data) =>
    axios.post(`${API_URL}/booking/bookings`, data, { headers: getHeaders() }),

  getMyBookings: () =>
    axios.get(`${API_URL}/booking/bookings/my`, { headers: getHeaders() }),

  cancelBooking: (bookingId) =>
    axios.post(`${API_URL}/booking/bookings/${bookingId}/cancel`, {}, { headers: getHeaders() }),

  getMyCredits: () =>
    axios.get(`${API_URL}/booking/credits/my`, { headers: getHeaders() }),

  getClosures: () =>
    axios.get(`${API_URL}/booking/closures`, { headers: getHeaders() }),

  createClosure: (data) =>
    axios.post(`${API_URL}/booking/closures`, data, { headers: getHeaders() }),

  deleteClosure: (id) =>
    axios.delete(`${API_URL}/booking/closures/${id}`, { headers: getHeaders() }),

  getMemberships: () =>
    axios.get(`${API_URL}/booking/memberships`, { headers: getHeaders() }),

  createMembership: (data) =>
    axios.post(`${API_URL}/booking/memberships`, data, { headers: getHeaders() }),

  updateMembership: (id, data) =>
    axios.patch(`${API_URL}/booking/memberships/${id}`, data, { headers: getHeaders() }),
};
