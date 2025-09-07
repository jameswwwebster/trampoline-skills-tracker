import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

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
      setSuccess(`✅ Certificate ${statusText} for ${gymnastName}!`);
      
      // Clear success message after 4 seconds
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {

      setError(err.response?.data?.error || err.message || 'Failed to update certificate status');
    }
  };

  const handleRevertCertificate = async (certificateId) => {
    if (window.confirm('Are you sure you want to revert this certificate to the awarded state? This will undo any printed/delivered status.')) {
      await handleStatusUpdate(certificateId, 'AWARDED');
    }
  };

  const handleDeleteCertificate = async (certificateId) => {
    const certificate = certificates.find(c => c.id === certificateId);
    const gymnastName = certificate ? `${certificate.gymnast?.firstName} ${certificate.gymnast?.lastName}` : 'gymnast';
    
    if (window.confirm(`Are you sure you want to delete this certificate for ${gymnastName}? This action cannot be undone.`)) {
      try {
        setError(null);
        setSuccess(null);
        
        await axios.delete(`/api/certificates/${certificateId}`);
        
        // Refresh certificates
        await fetchData();
        
        setSuccess(`✅ Certificate deleted for ${gymnastName}!`);
        setTimeout(() => setSuccess(null), 4000);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to delete certificate');
      }
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
      setSuccess(`🏆 Certificate awarded successfully to ${gymnastName}!`);
      
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
      
      console.log('🖼️ Certificate PNG downloaded successfully');
    } catch (err) {
      console.error('Download error:', err);
      setError(err.response?.data?.error || 'Failed to download certificate. Please try again.');
    }
  };



  const getStatusBadge = (status) => {
    switch (status) {
      case 'AWARDED':
        return <span className="badge badge-warning">🏆 Awarded</span>;
      case 'PRINTED':
        return <span className="badge badge-info">📝 Marked as Printed</span>;
      case 'DELIVERED':
        return <span className="badge badge-success">✅ Delivered</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const getTypeText = (type) => {
    switch (type) {
      case 'LEVEL_COMPLETION':
        return 'Level Completion';
      case 'SPECIAL_ACHIEVEMENT':
        return 'Special Achievement';
      case 'PARTICIPATION':
        return 'Participation';
      default:
        return type;
    }
  };

  const filteredCertificates = certificates.filter(cert => {
    if (filters.status && cert.status !== filters.status) return false;
    if (filters.gymnastId && cert.gymnast.id !== filters.gymnastId) return false;
    return true;
  });

  if (!canManageGymnasts) {
    return (
      <div className="container">
        <div className="alert alert-warning">
          <h4>Access Denied</h4>
          <p>You don't have permission to manage certificates. Only coaches and club administrators can access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p>Loading certificates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container certificates-page">
      <div className="page-header">
        <h1>Certificate Management</h1>
        <p>Manage and track certificates for gymnasts</p>
      </div>

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
          <button 
            className="btn btn-sm btn-outline-danger float-right"
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
            className="btn btn-sm btn-outline-success float-right"
            onClick={() => setSuccess(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="nav nav-tabs mb-4">
        <button
          className={`nav-link ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          📋 All Certificates ({certificates.length})
        </button>
        <button
          className={`nav-link ${activeTab === 'award' ? 'active' : ''}`}
          onClick={() => setActiveTab('award')}
        >
          🏆 Award Certificate
        </button>
      </div>

      {activeTab === 'list' && (
        <div>
          {/* Filters */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title">Filters</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-3">
                  <label>Status</label>
                  <select
                    className="form-control"
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                  >
                    <option value="">All Statuses</option>
                    <option value="AWARDED">Awarded</option>
                    <option value="PRINTED">Marked as Printed</option>
                    <option value="DELIVERED">Delivered</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label>Gymnast</label>
                  <select
                    className="form-control"
                    value={filters.gymnastId}
                    onChange={(e) => setFilters({...filters, gymnastId: e.target.value})}
                  >
                    <option value="">All Gymnasts</option>
                    {gymnasts.map(gymnast => (
                      <option key={gymnast.id} value={gymnast.id}>
                        {gymnast.firstName} {gymnast.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setFilters({ status: '', gymnastId: '' })}
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Certificates List */}
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                Certificates ({filteredCertificates.length})
              </h5>
            </div>
            <div className="card-body">
              {filteredCertificates.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted">No certificates found matching the current filters.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Gymnast</th>
                        <th>Level</th>
                        <th>Status</th>
                        <th>Awarded</th>
                        <th>Awarded By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCertificates.map(certificate => (
                        <tr key={certificate.id}>
                          <td>
                            <strong>{certificate.gymnast.firstName} {certificate.gymnast.lastName}</strong>
                          </td>
                          <td>
                            {certificate.level.identifier}: {certificate.level.name}
                          </td>
                          <td>{getStatusBadge(certificate.status)}</td>
                          <td>
                            <small>{new Date(certificate.awardedAt).toLocaleDateString()}</small>
                          </td>
                          <td>
                            <small>
                              {certificate.awardedBy.firstName} {certificate.awardedBy.lastName}
                            </small>
                          </td>
                          <td className="certificate-actions">
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-primary"
                                onClick={() => handleDownloadCertificate(certificate.id)}
                                title="Download Certificate PNG"
                              >
                                📥 Download
                              </button>
                              {certificate.status === 'AWARDED' && (
                                <>
                                  <button
                                    className="btn btn-info"
                                    onClick={() => handleStatusUpdate(certificate.id, 'PRINTED')}
                                    title="Mark as Printed"
                                  >
                                    📝 Mark Printed
                                  </button>
                                  <button
                                    className="btn btn-success"
                                    onClick={() => handleStatusUpdate(certificate.id, 'DELIVERED')}
                                    title="Mark as Delivered"
                                  >
                                    ✅ Deliver
                                  </button>
                                </>
                              )}
                              {certificate.status === 'PRINTED' && (
                                <button
                                  className="btn btn-success"
                                  onClick={() => handleStatusUpdate(certificate.id, 'DELIVERED')}
                                  title="Mark as Delivered"
                                >
                                  ✅ Deliver
                                </button>
                              )}
                              {(certificate.status === 'PRINTED' || certificate.status === 'DELIVERED') && (
                                <button
                                  className="btn btn-warning"
                                  onClick={() => handleRevertCertificate(certificate.id)}
                                  title="Revert to Awarded"
                                >
                                  ↩️ Revert
                                </button>
                              )}
                              <button
                                className="btn btn-danger"
                                onClick={() => handleDeleteCertificate(certificate.id)}
                                title="Delete Certificate"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'award' && (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title">Award New Certificate</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleAwardCertificate}>
              <div className="row">
                <div className="col-md-6">
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
                </div>
                <div className="col-md-6">
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
              </div>
              
              <div className="row">
                <div className="col-md-6">
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
                        <span className="text-primary">
                          {' '}Default: {templates.find(t => t.isDefault).name}
                        </span>
                      )}
                    </small>
                  </div>
                </div>
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

              <div className="form-group">
                <button type="submit" className="btn award-certificate-btn">
                  🏆 Award Certificate
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary ml-2"
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

            <div className="alert alert-info mt-3">
              <strong>📧 Email Notification:</strong> Parents/guardians will automatically receive an email notification when a certificate is awarded.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Certificates; 