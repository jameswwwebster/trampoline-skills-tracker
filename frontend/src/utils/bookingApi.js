import axios from 'axios';

const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const bookingApi = {
  getBookableGymnasts: () =>
    axios.get(`${API_URL}/gymnasts/bookable-for-me`, { headers: getHeaders() }),

  createSelfGymnast: (data) =>
    axios.post(`${API_URL}/gymnasts/self`, data, { headers: getHeaders() }),

  addChild: (data) =>
    axios.post(`${API_URL}/gymnasts/add-child`, data, { headers: getHeaders() }),

  updateGymnast: (gymnastId, data) =>
    axios.put(`${API_URL}/gymnasts/${gymnastId}`, data, { headers: getHeaders() }),

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

  cancelBooking: (bookingId, options = {}) =>
    axios.post(`${API_URL}/booking/bookings/${bookingId}/cancel`, options, { headers: getHeaders() }),

  getMyCredits: () =>
    axios.get(`${API_URL}/booking/credits/my`, { headers: getHeaders() }),

  applyCreditToMembership: (creditId) =>
    axios.post(`${API_URL}/booking/credits/${creditId}/apply-to-membership`, {}, { headers: getHeaders() }),

  getAllCredits: () =>
    axios.get(`${API_URL}/booking/credits/all`, { headers: getHeaders() }),

  assignCredit: (data) =>
    axios.post(`${API_URL}/booking/credits/assign`, data, { headers: getHeaders() }),

  getMembers: () =>
    axios.get(`${API_URL}/users`, { headers: getHeaders() }),

  getMember: (userId) =>
    axios.get(`${API_URL}/users/${userId}`, { headers: getHeaders() }),

  updateMemberProfile: (userId, data) =>
    axios.put(`${API_URL}/users/${userId}/profile`, data, { headers: getHeaders() }),

  createUser: (data) =>
    axios.post(`${API_URL}/users`, data, { headers: getHeaders() }),

  changeRole: (userId, role) =>
    axios.put(`${API_URL}/users/${userId}/role`, { role }, { headers: getHeaders() }),

  resetPassword: (userId) =>
    axios.post(`${API_URL}/users/${userId}/reset-password`, {}, { headers: getHeaders() }),

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

  deleteMembership: (id) =>
    axios.delete(`${API_URL}/booking/memberships/${id}`, { headers: getHeaders() }),

  getMyMemberships: () =>
    axios.get(`${API_URL}/booking/memberships/my`, { headers: getHeaders() }),

  getMembershipClientSecret: (membershipId) =>
    axios.get(`${API_URL}/booking/memberships/${membershipId}/client-secret`, { headers: getHeaders() }),

  getMembershipSetupIntent: (membershipId) =>
    axios.post(`${API_URL}/booking/memberships/${membershipId}/setup-intent`, {}, { headers: getHeaders() }),

  confirmMembershipPaymentMethod: (membershipId, paymentMethodId) =>
    axios.post(`${API_URL}/booking/memberships/${membershipId}/confirm-payment-method`, { paymentMethodId }, { headers: getHeaders() }),

  getDelinquentMemberships: () =>
    axios.get(`${API_URL}/booking/memberships/delinquent`, { headers: getHeaders() }),

  sendMembershipReminder: (id) =>
    axios.post(`${API_URL}/booking/memberships/${id}/remind`, {}, { headers: getHeaders() }),

  joinWaitlist: (instanceId) =>
    axios.post(`${API_URL}/booking/waitlist/${instanceId}`, {}, { headers: getHeaders() }),

  leaveWaitlist: (instanceId) =>
    axios.delete(`${API_URL}/booking/waitlist/${instanceId}`, { headers: getHeaders() }),

  getMyWaitlist: () =>
    axios.get(`${API_URL}/booking/waitlist/my`, { headers: getHeaders() }),

  adminAddChild: (data) =>
    axios.post(`${API_URL}/gymnasts/admin-add-child`, data, { headers: getHeaders() }),

  deleteGymnast: (id) =>
    axios.delete(`${API_URL}/booking/admin/gymnasts/${id}`, { headers: getHeaders() }),

  deleteMember: (userId) =>
    axios.delete(`${API_URL}/booking/admin/members/${userId}`, { headers: getHeaders() }),

  testEmail: (email) =>
    axios.post(`${API_URL}/users/test-email`, { email }, { headers: getHeaders() }),
};

// Audit log
export const getAuditLog = (params) =>
  axios.get(`${API_URL}/booking/admin/audit-log`, { params, headers: getHeaders() });

export const getAuditStaff = () =>
  axios.get(`${API_URL}/booking/admin/audit-log/staff`, { headers: getHeaders() });

// Session templates (admin)
export const getTemplates = () =>
  axios.get(`${API_URL}/booking/templates`, { headers: getHeaders() });

export const createTemplate = (data) =>
  axios.post(`${API_URL}/booking/templates`, data, { headers: getHeaders() });

export const updateTemplate = (id, data) =>
  axios.put(`${API_URL}/booking/templates/${id}`, data, { headers: getHeaders() });

export const toggleTemplate = (id, applyToFutureInstances) =>
  axios.patch(`${API_URL}/booking/templates/${id}/toggle`, { applyToFutureInstances }, { headers: getHeaders() });

export const deleteTemplate = (id, applyToFutureInstances) =>
  axios.delete(`${API_URL}/booking/templates/${id}`, { data: { applyToFutureInstances }, headers: getHeaders() });
