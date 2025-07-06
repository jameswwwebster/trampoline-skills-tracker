import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './CertificateDisplay.css';

const CERTIFICATES_PER_PAGE = 4;

const CertificateDisplay = ({ gymnastId, showActions = true }) => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCertificates: 0,
    limit: CERTIFICATES_PER_PAGE,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const { } = useAuth();

  const fetchCertificates = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/certificates/gymnast/${gymnastId}?page=${page}&limit=${CERTIFICATES_PER_PAGE}`);
      
      // Handle the new response format with pagination
      if (response.data.certificates) {
        setCertificates(response.data.certificates);
        setPagination(response.data.pagination);
        
        // Fetch preview images for each certificate
        const imagePromises = response.data.certificates.map(async (certificate) => {
          try {
            const imageResponse = await axios.get(`/api/certificates/${certificate.id}/preview`, {
              responseType: 'blob'
            });
            const imageUrl = URL.createObjectURL(imageResponse.data);
            return { id: certificate.id, url: imageUrl };
          } catch (err) {
            console.error(`Failed to fetch preview for certificate ${certificate.id}:`, err);
            return { id: certificate.id, url: null };
          }
        });
        
        const imageResults = await Promise.all(imagePromises);
        const imageUrlMap = {};
        imageResults.forEach(result => {
          imageUrlMap[result.id] = result.url;
        });
        setImageUrls(imageUrlMap);
      } else {
        // Fallback for old API response format
        setCertificates(response.data);
      }
      
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch certificates');
    } finally {
      setLoading(false);
    }
  }, [gymnastId]);

  useEffect(() => {
    fetchCertificates(1);
    
    // Cleanup function to revoke object URLs when component unmounts
    return () => {
      Object.values(imageUrls).forEach(url => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [fetchCertificates]);

  const handlePageChange = (newPage) => {
    fetchCertificates(newPage);
  };

  const handleDownloadCertificate = async (certificateId) => {
    try {
      console.log('🔄 Downloading certificate...');
      const response = await axios.get(`/api/certificates/${certificateId}/download`, {
        responseType: 'blob'
      });
      
      // Create blob URL and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `certificate-${certificateId}.png`);
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

  const handleViewCertificate = (certificate) => {
    setSelectedCertificate(certificate);
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

  if (loading) {
    return (
      <div className="certificate-display">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading certificates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="certificate-display">
        <div className="alert alert-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="certificate-display">
      <div className="certificate-header">
        <h3>🏆 Certificates ({pagination.totalCertificates})</h3>
        {pagination.totalCertificates > CERTIFICATES_PER_PAGE && (
          <p className="pagination-info">
            Showing page {pagination.currentPage} of {pagination.totalPages}
          </p>
        )}
      </div>

      {certificates.length === 0 && pagination.totalCertificates === 0 ? (
        <div className="no-certificates">
          <div className="empty-state">
            <span className="empty-icon">🏆</span>
            <h4>No Certificates Yet</h4>
            <p>Certificates will appear here when awarded for completed levels and achievements.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="certificates-grid">
            {certificates.map(certificate => (
            <div key={certificate.id} className="certificate-card">
              <div className="certificate-preview">
                {imageUrls[certificate.id] ? (
                  <img 
                    src={imageUrls[certificate.id]}
                    alt={`Certificate for Level ${certificate.level.identifier}`}
                    className="certificate-preview-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="certificate-template">
                    <div className="certificate-content">
                      <h4>Certificate of Achievement</h4>
                      <p className="certificate-type">{getTypeText(certificate.type)}</p>
                      <div className="certificate-level">
                        Level {certificate.level.identifier}
                      </div>
                      <div className="certificate-level-name">
                        {certificate.level.name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="certificate-info">
                <div className="certificate-meta">
                  <div className="certificate-title">
                    {getTypeText(certificate.type)}
                  </div>
                  <div className="certificate-level-badge">
                    <span className="badge badge-primary">
                      Level {certificate.level.identifier}
                    </span>
                  </div>
                  {getStatusBadge(certificate.status)}
                </div>
                
                <div className="certificate-details">
                  <small className="text-muted">
                    Awarded: {new Date(certificate.awardedAt).toLocaleDateString()}
                  </small>
                  {certificate.notes && (
                    <small className="certificate-notes">
                      {certificate.notes}
                    </small>
                  )}
                </div>

                {showActions && (
                  <div className="certificate-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleViewCertificate(certificate)}
                    >
                      👁️ View
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleDownloadCertificate(certificate.id)}
                    >
                      📥 Download
                    </button>
                  </div>
                )}
              </div>
            </div>
                      ))}
          </div>
          
          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPreviousPage}
              >
                ← Previous
              </button>
              
              <span className="pagination-info">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Certificate Modal */}
      {selectedCertificate && (
        <div className="modal-overlay" onClick={() => setSelectedCertificate(null)}>
          <div className="modal certificate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Certificate Preview</h3>
              <button 
                className="close-button"
                onClick={() => setSelectedCertificate(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="certificate-full-preview">
                {imageUrls[selectedCertificate.id] ? (
                  <img 
                    src={imageUrls[selectedCertificate.id]}
                    alt={`Certificate for Level ${selectedCertificate.level.identifier}`}
                    className="certificate-modal-image"
                  />
                ) : (
                  <div className="certificate-template large">
                    <div className="certificate-content">
                      <div className="certificate-header-text">Certificate of Achievement</div>
                      <div className="certificate-subtitle">
                        This certifies that
                      </div>
                      <div className="certificate-recipient">
                        [Gymnast Name]
                      </div>
                      <div className="certificate-achievement">
                        has successfully completed
                      </div>
                      <div className="certificate-level-display">
                        Level {selectedCertificate.level.identifier}
                      </div>
                      <div className="certificate-level-name-display">
                        {selectedCertificate.level.name}
                      </div>
                      <div className="certificate-date">
                        {new Date(selectedCertificate.awardedAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="certificate-signature">
                        <div className="signature-line"></div>
                        <div className="signature-label">Instructor</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-success"
                onClick={() => handleDownloadCertificate(selectedCertificate.id)}
              >
                📥 Download Certificate
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setSelectedCertificate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateDisplay; 