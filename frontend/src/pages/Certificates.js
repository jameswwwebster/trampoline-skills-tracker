import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getStatusBadge, getTypeText } from '../utils/certificateUtils';
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline';

const Certificates = () => {
  const [certificates, setCertificates] = useState([]);
  const [gymnasts, setGymnasts] = useState([]);
  const [levels, setLevels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [filters, setFilters] = useState({
    status: '',
    gymnastId: ''
  });

  const [awardForm, setAwardForm] = useState({
    gymnastId: '',
    levelId: '',
    templateId: '',
    notes: ''
  });
  const [revertingCertificateId, setRevertingCertificateId] = useState(null);
  const [deletingCertificateId, setDeletingCertificateId] = useState(null);
  const { canManageGymnasts } = useAuth();

  useEffect(() => {
    if (canManageGymnasts) {
      fetchData();
    }
  }, [canManageGymnasts]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [certificatesRes, gymnastsRes, levelsRes, templatesRes] = await Promise.all([
        axios.get('/api/certificates'),
        axios.get('/api/gymnasts'),
        axios.get('/api/levels'),
        axios.get('/api/certificate-templates')
      ]);

      setCertificates(certificatesRes.data);
      setGymnasts(gymnastsRes.data);
      setLevels(levelsRes.data);
      setTemplates(templatesRes.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (certificateId, status) => {
    try {
      setError(null); // Clear any previous errors
      setSuccess(null); // Clear any previous success messages

      
      await axios.put(`/api/certificates/${certificateId}/status`, { status });
      

      // Refresh certificates
      await fetchData();
      
      // Show success message
      const certificate = certificates.find(c => c.id === certificateId);
      const gymnastName = certificate ? `${certificate.gymnast?.firstName} ${certificate.gymnast?.lastName}` : 'gymnast';
      const statusText = status === 'PRINTED' ? 'marked as printed' : 
                        status === 'DELIVERED' ? 'marked as delivered' : 
                        status === 'AWARDED' ? 'reverted to awarded' : 'updated';
      setSuccess(`Certificate ${statusText} for ${gymnastName}!`);
      
      // Clear success message after 4 seconds
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {

      setError(err.response?.data?.error || err.message || 'Failed to update certificate status');
    }
  };

  const handleRevertCertificate = (certificateId) => {
    setRevertingCertificateId(certificateId);
  };

  const confirmRevertCertificate = async () => {
    const id = revertingCertificateId;
    setRevertingCertificateId(null);
    await handleStatusUpdate(id, 'AWARDED');
  };

  const handleDeleteCertificate = (certificateId) => {
    setDeletingCertificateId(certificateId);
  };

  const confirmDeleteCertificate = async () => {
    const certificateId = deletingCertificateId;
    const certificate = certificates.find(c => c.id === certificateId);
    const gymnastName = certificate ? `${certificate.gymnast?.firstName} ${certificate.gymnast?.lastName}` : 'gymnast';
    setDeletingCertificateId(null);
    try {
      setError(null);
      setSuccess(null);
      await axios.delete(`/api/certificates/${certificateId}`);
      await fetchData();
      setSuccess(`Certificate deleted for ${gymnastName}!`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete certificate');
    }
  };

  const handleAwardCertificate = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);
      
      await axios.post('/api/certificates', awardForm);

      // Get gymnast name for success message
      const gymnast = gymnasts.find(g => g.id === awardForm.gymnastId);
      const gymnastName = gymnast ? `${gymnast.firstName} ${gymnast.lastName}` : 'gymnast';
      
      // Reset form and refresh data
      setAwardForm({
        gymnastId: '',
        levelId: '',
        templateId: '',
        notes: ''
      });
      setActiveTab('list');
      fetchData();
      
      // Show success message
      setSuccess(`Certificate awarded successfully to ${gymnastName}!`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to award certificate');
    }
  };

  const handleDownloadCertificate = async (certificateId) => {
    try {
      setError(null); // Clear any previous errors
      
      const response = await axios.get(`/api/certificates/${certificateId}/download`, {
        responseType: 'blob'
      });
      
      // Find the certificate to get better filename
      const certificate = certificates.find(c => c.id === certificateId);
      const filename = certificate 
        ? `certificate-${certificate.gymnast?.firstName || 'gymnast'}-${certificate.gymnast?.lastName || 'name'}-level-${certificate.level.identifier}.png`
        : `certificate-${certificateId}.png`;
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'image/png' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
} catch (err) {
      setError(err.response?.data?.error || 'Failed to download certificate. Please try again.');
    }
  };



  const filteredCertificates = certificates.filter(cert => {
    if (filters.status && cert.status !== filters.status) return false;
    if (filters.gymnastId && cert.gymnast.id !== filters.gymnastId) return false;
    return true;
  });

  if (!canManageGymnasts) {
    return (
      <div className="alert alert-error">
        <h4>Access Denied</h4>
        <p>You don't have permission to manage certificates. Only coaches and club administrators can access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading"><div className="spinner" /></div>
    );
  }

  return (
    <div className="certificates-page">
      <div className="page-header">
        <h1>Certificate Management</h1>
        <p>Manage and track certificates for gymnasts</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
          <button
            className="btn btn-sm btn-outline"
            style={{ float: 'right' }}
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <strong>Success:</strong> {success}
          <button
            className="btn btn-sm btn-outline"
            style={{ float: 'right' }}
            onClick={() => setSuccess(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button
          className={`nav-link ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          All Certificates ({certificates.length})
        </button>
        <button
          className={`nav-link ${activeTab === 'award' ? 'active' : ''}`}
          onClick={() => setActiveTab('award')}
        >
          Award Certificate
        </button>
      </div>

      {activeTab === 'list' && (
        <div>
          {/* Certificates List */}
          <div className="card">
            <div className="card-header cert-list-header">
              <h5 className="card-title">
                Certificates ({filteredCertificates.length}{filters.status || filters.gymnastId ? ' filtered' : ''})
              </h5>
              <div className="cert-inline-filters">
                <select
                  className="form-control form-control-sm"
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                >
                  <option value="">All statuses</option>
                  <option value="AWARDED">Awarded</option>
                  <option value="PRINTED">Printed</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
                <select
                  className="form-control form-control-sm"
                  value={filters.gymnastId}
                  onChange={(e) => setFilters({...filters, gymnastId: e.target.value})}
                >
                  <option value="">All gymnasts</option>
                  {gymnasts.map(gymnast => (
                    <option key={gymnast.id} value={gymnast.id}>
                      {gymnast.firstName} {gymnast.lastName}
                    </option>
                  ))}
                </select>
                {(filters.status || filters.gymnastId) && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setFilters({ status: '', gymnastId: '' })}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
              {filteredCertificates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <p className="text-muted">No certificates found matching the current filters.</p>
                </div>
              ) : (
                <div className="certificate-list">
                  {filteredCertificates.map(certificate => (
                    <div key={certificate.id} className="certificate-card">
                      <div className="certificate-card-header">
                        <div>
                          <strong className="certificate-gymnast-name">
                            {certificate.gymnast.firstName} {certificate.gymnast.lastName}
                          </strong>
                          <span className="certificate-level">
                            Level {certificate.level.identifier}: {certificate.level.name}
                          </span>
                        </div>
                        {getStatusBadge(certificate.status)}
                      </div>
                      <div className="certificate-card-meta">
                        <span>Awarded {new Date(certificate.awardedAt).toLocaleDateString()}</span>
                        <span>by {certificate.awardedBy.firstName} {certificate.awardedBy.lastName}</span>
                      </div>
                      <div className="certificate-card-actions">
                        <div className="cert-workflow-actions">
                          <button
                            className="cert-action-btn cert-action-download"
                            onClick={() => handleDownloadCertificate(certificate.id)}
                            title="Download certificate"
                          >
                            <ArrowDownTrayIcon className="cert-action-icon" />
                            Download
                          </button>
                          {certificate.status === 'AWARDED' && (
                            <>
                              <button
                                className="cert-action-btn"
                                onClick={() => handleStatusUpdate(certificate.id, 'PRINTED')}
                              >
                                Mark Printed
                              </button>
                              <button
                                className="cert-action-btn cert-action-deliver"
                                onClick={() => handleStatusUpdate(certificate.id, 'DELIVERED')}
                              >
                                Mark Delivered
                              </button>
                            </>
                          )}
                          {certificate.status === 'PRINTED' && (
                            <button
                              className="cert-action-btn cert-action-deliver"
                              onClick={() => handleStatusUpdate(certificate.id, 'DELIVERED')}
                            >
                              Mark Delivered
                            </button>
                          )}
                          {(certificate.status === 'PRINTED' || certificate.status === 'DELIVERED') && (
                            <button
                              className="cert-action-btn cert-action-revert"
                              onClick={() => handleRevertCertificate(certificate.id)}
                            >
                              Revert
                            </button>
                          )}
                        </div>
                        <button
                          className="cert-action-btn cert-action-delete"
                          onClick={() => handleDeleteCertificate(certificate.id)}
                          title="Delete certificate"
                        >
                          <TrashIcon className="cert-action-icon" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}

      {activeTab === 'award' && (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title">Award New Certificate</h5>
          </div>
            <form onSubmit={handleAwardCertificate}>
              <div className="form-row">
                <div className="form-group">
                  <label>Gymnast *</label>
                  <select
                    className="form-control"
                    value={awardForm.gymnastId}
                    onChange={(e) => setAwardForm({...awardForm, gymnastId: e.target.value})}
                    required
                  >
                    <option value="">Select a gymnast...</option>
                    {gymnasts.map(gymnast => (
                      <option key={gymnast.id} value={gymnast.id}>
                        {gymnast.firstName} {gymnast.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Level *</label>
                  <select
                    className="form-control"
                    value={awardForm.levelId}
                    onChange={(e) => setAwardForm({...awardForm, levelId: e.target.value})}
                    required
                  >
                    <option value="">Select a level...</option>
                    {levels.map(level => (
                      <option key={level.id} value={level.id}>
                        {level.identifier} - {level.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Certificate Template</label>
                <select
                  className="form-control"
                  value={awardForm.templateId}
                  onChange={(e) => setAwardForm({...awardForm, templateId: e.target.value})}
                >
                  <option value="">Use default template</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}{template.isDefault ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
                <small className="form-text text-muted">
                  Select a custom template or leave empty to use the default template.
                  {templates.find(t => t.isDefault) && (
                    <span>
                      {' '}Default: {templates.find(t => t.isDefault).name}
                    </span>
                  )}
                </small>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={awardForm.notes}
                  onChange={(e) => setAwardForm({...awardForm, notes: e.target.value})}
                  placeholder="Optional notes about this certificate..."
                />
              </div>

              <div className="alert alert-info">
                <strong>Email Notification:</strong> Parents/guardians will automatically receive an email notification when a certificate is awarded.
              </div>

              <div className="form-group">
                <button type="submit" className="btn award-certificate-btn">
                  Award Certificate
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => setAwardForm({
                    gymnastId: '',
                    levelId: '',
                    templateId: '',
                    notes: ''
                  })}
                >
                  Clear Form
                </button>
              </div>
            </form>
        </div>
      )}
      {revertingCertificateId && (() => {
        const cert = certificates.find(c => c.id === revertingCertificateId);
        const name = cert ? `${cert.gymnast?.firstName} ${cert.gymnast?.lastName}` : 'this gymnast';
        return (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Revert Certificate</h3>
              <p>Are you sure you want to revert the certificate for <strong>{name}</strong> to the awarded state? This will undo any printed/delivered status.</p>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setRevertingCertificateId(null)}>Cancel</button>
                <button className="btn btn-warning" onClick={confirmRevertCertificate}>Revert</button>
              </div>
            </div>
          </div>
        );
      })()}

      {deletingCertificateId && (() => {
        const cert = certificates.find(c => c.id === deletingCertificateId);
        const name = cert ? `${cert.gymnast?.firstName} ${cert.gymnast?.lastName}` : 'this gymnast';
        return (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Delete Certificate</h3>
              <p>Are you sure you want to delete the certificate for <strong>{name}</strong>? This action cannot be undone.</p>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setDeletingCertificateId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDeleteCertificate}>Delete</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Certificates;