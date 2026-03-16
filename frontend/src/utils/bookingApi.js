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

  updateHealthNotes: (gymnastId, data) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/health-notes`, data, { headers: getHeaders() }),

  updateConsents: (gymnastId, data) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/consents`, data, { headers: getHeaders() }),

  approveDmt: (gymnastId, approved) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/dmt-approval`, { approved }, { headers: getHeaders() }),

  setBgNumber: (gymnastId, bgNumber) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/bg-number`, { bgNumber }, { headers: getHeaders() }),
  verifyBgNumber: (gymnastId, action) =>
    axios.patch(`${API_URL}/gymnasts/${gymnastId}/bg-number/verify`, { action }, { headers: getHeaders() }),
  getAdminBgNumbers: () =>
    axios.get(`${API_URL}/gymnasts/admin/bg-numbers`, { headers: getHeaders() }),

  getSessions: (year, month) =>
    axios.get(`${API_URL}/booking/sessions`, {
      params: { year, month },
      headers: getHeaders(),
    }),

  getSession: (instanceId) =>
    axios.get(`${API_URL}/booking/sessions/${instanceId}`, { headers: getHeaders() }),

  createBooking: (data) =>
    axios.post(`${API_URL}/booking/bookings`, data, { headers: getHeaders() }),

  createBatchBooking: (data) =>
    axios.post(`${API_URL}/booking/bookings/batch`, data, { headers: getHeaders() }),

  combinedCheckout: (data) =>
    axios.post(`${API_URL}/booking/bookings/combined`, data, { headers: getHeaders() }),

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

  markAdultAsGymnast: (userId) =>
    axios.post(`${API_URL}/gymnasts/admin-mark-adult`, { userId }, { headers: getHeaders() }),

  deleteGymnast: (id) =>
    axios.delete(`${API_URL}/booking/admin/gymnasts/${id}`, { headers: getHeaders() }),

  deleteMember: (userId) =>
    axios.delete(`${API_URL}/booking/admin/members/${userId}`, { headers: getHeaders() }),

  testEmail: (email) =>
    axios.post(`${API_URL}/users/test-email`, { email }, { headers: getHeaders() }),

  // Messages
  getMessages: () =>
    axios.get(`${API_URL}/messages`, { headers: getHeaders() }),
  getMessage: (id) =>
    axios.get(`${API_URL}/messages/${id}`, { headers: getHeaders() }),
  previewRecipients: (recipientFilter) =>
    axios.post(`${API_URL}/messages/preview-recipients`, { recipientFilter }, { headers: getHeaders() }),
  createMessage: (data) =>
    axios.post(`${API_URL}/messages`, data, { headers: getHeaders() }),
  updateMessage: (id, data) =>
    axios.patch(`${API_URL}/messages/${id}`, data, { headers: getHeaders() }),
  sendMessage: (id) =>
    axios.post(`${API_URL}/messages/${id}/send`, {}, { headers: getHeaders() }),
  deleteMessage: (id) =>
    axios.delete(`${API_URL}/messages/${id}`, { headers: getHeaders() }),
  getArchivedMembers: () =>
    axios.get(`${API_URL}/messages/archived-members`, { headers: getHeaders() }),

  // Noticeboard
  getNoticeboard: () =>
    axios.get(`${API_URL}/noticeboard`, { headers: getHeaders() }),
  createNoticeboardPost: (data) =>
    axios.post(`${API_URL}/noticeboard`, data, { headers: getHeaders() }),
  updateNoticeboardPost: (id, data) =>
    axios.patch(`${API_URL}/noticeboard/${id}`, data, { headers: getHeaders() }),
  deleteNoticeboardPost: (id) =>
    axios.delete(`${API_URL}/noticeboard/${id}`, { headers: getHeaders() }),
  markNoticeboardRead: (id) =>
    axios.post(`${API_URL}/noticeboard/${id}/read`, {}, { headers: getHeaders() }),

  // Recipient groups
  getRecipientGroups: () =>
    axios.get(`${API_URL}/recipient-groups`, { headers: getHeaders() }),
  createRecipientGroup: (data) =>
    axios.post(`${API_URL}/recipient-groups`, data, { headers: getHeaders() }),
  updateRecipientGroup: (id, data) =>
    axios.patch(`${API_URL}/recipient-groups/${id}`, data, { headers: getHeaders() }),
  deleteRecipientGroup: (id) =>
    axios.delete(`${API_URL}/recipient-groups/${id}`, { headers: getHeaders() }),

  // Noticeboard recipient preview
  previewNoticeboardRecipients: (recipientFilter) =>
    axios.post(`${API_URL}/noticeboard/preview-recipients`, { recipientFilter }, { headers: getHeaders() }),

  // Commitments
  getCommitmentsForTemplate: (templateId) =>
    axios.get(`${API_URL}/commitments?templateId=${templateId}`, { headers: getHeaders() }),
  getCommitmentsForGymnast: (gymnastId) =>
    axios.get(`${API_URL}/commitments/gymnast/${gymnastId}`, { headers: getHeaders() }),
  getMyCommitmentsForTemplate: (templateId) =>
    axios.get(`${API_URL}/commitments/mine?templateId=${templateId}`, { headers: getHeaders() }),
  createCommitment: (data) =>
    axios.post(`${API_URL}/commitments`, data, { headers: getHeaders() }),
  updateCommitmentStatus: (commitmentId, status) =>
    axios.patch(`${API_URL}/commitments/${commitmentId}/status`, { status }, { headers: getHeaders() }),
  deleteCommitment: (commitmentId) =>
    axios.delete(`${API_URL}/commitments/${commitmentId}`, { headers: getHeaders() }),

  // Charges
  getMyCharges: () =>
    axios.get(`${API_URL}/booking/charges/my`, { headers: getHeaders() }),
  getAdminCharges: () =>
    axios.get(`${API_URL}/booking/charges`, { headers: getHeaders() }),
  getChargesForUser: (userId) =>
    axios.get(`${API_URL}/booking/charges?userId=${encodeURIComponent(userId)}`, { headers: getHeaders() }),
  createCharge: (data) =>
    axios.post(`${API_URL}/booking/charges`, data, { headers: getHeaders() }),
  deleteCharge: (id) =>
    axios.delete(`${API_URL}/booking/charges/${id}`, { headers: getHeaders() }),
  deleteCredit: (id) =>
    axios.delete(`${API_URL}/booking/credits/${id}`, { headers: getHeaders() }),

  // Attendance register
  getAttendance: (instanceId) =>
    axios.get(`${API_URL}/booking/attendance/${instanceId}`, { headers: getHeaders() }),

  createAttendance: (instanceId, data) =>
    axios.post(`${API_URL}/booking/attendance/${instanceId}`, data, { headers: getHeaders() }),

  deleteAttendance: (instanceId, gymnastId) =>
    axios.delete(`${API_URL}/booking/attendance/${instanceId}/${gymnastId}`, { headers: getHeaders() }),

  // Recurring credits
  getRecurringCredits: () =>
    axios.get(`${API_URL}/booking/recurring-credits`, { headers: getHeaders() }),

  createRecurringCredit: (data) =>
    axios.post(`${API_URL}/booking/recurring-credits`, data, { headers: getHeaders() }),

  deleteRecurringCredit: (id) =>
    axios.delete(`${API_URL}/booking/recurring-credits/${id}`, { headers: getHeaders() }),
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
