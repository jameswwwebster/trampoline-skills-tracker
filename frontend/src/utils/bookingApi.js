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

  updateEmergencyContact: (gymnastId, data) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/emergency-contact`, data, { headers: getHeaders() }),

  updateConsents: (gymnastId, data) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/consents`, data, { headers: getHeaders() }),

  confirmInsurance: (gymnastId, confirmed) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/insurance`, { confirmed }, { headers: getHeaders() }),

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

  getAllCredits: () =>
    axios.get(`${API_URL}/booking/credits/all`, { headers: getHeaders() }),

  assignCredit: (data) =>
    axios.post(`${API_URL}/booking/credits/assign`, data, { headers: getHeaders() }),

  adminAddToSession: (data) =>
    axios.post(`${API_URL}/booking/bookings/admin-add`, data, { headers: getHeaders() }),

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

  joinWaitlist: (instanceId) =>
    axios.post(`${API_URL}/booking/waitlist/${instanceId}`, {}, { headers: getHeaders() }),

  leaveWaitlist: (instanceId) =>
    axios.delete(`${API_URL}/booking/waitlist/${instanceId}`, { headers: getHeaders() }),

  getMyWaitlist: () =>
    axios.get(`${API_URL}/booking/waitlist/my`, { headers: getHeaders() }),
};
