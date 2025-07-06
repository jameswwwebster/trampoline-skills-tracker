import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const CertificatePreview = () => {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [certificate, setCertificate] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCertificate();
    return () => {
      // Cleanup image URL when component unmounts
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [certificateId]);

  const fetchCertificate = async () => {
    try {
      setLoading(true);
      
      // Fetch certificate details
      const certificateResponse = await axios.get(`/api/certificates`);
      const foundCertificate = certificateResponse.data.find(cert => cert.id === certificateId);
      
      if (!foundCertificate) {
        setError('Certificate not found');
        return;
      }
      
      setCertificate(foundCertificate);
      
      // Fetch certificate preview image
      const imageResponse = await axios.get(`/api/certificates/${certificateId}/preview`, {
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(imageResponse.data);
      setImageUrl(url);
      
    } catch (err) {
      console.error('Error fetching certificate:', err);
      setError(err.response?.data?.error || 'Failed to load certificate');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await axios.get(`/api/certificates/${certificateId}/download`, {
        responseType: 'blob'
      });
      
      const filename = certificate 
        ? `certificate-${certificate.gymnast?.firstName || 'gymnast'}-${certificate.gymnast?.lastName || 'name'}-level-${certificate.level.identifier}.png`
        : `certificate-${certificateId}.png`;
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download certificate');
    }
  };

  const handlePrint = () => {
    if (imageUrl) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Certificate - ${certificate?.gymnast?.firstName} ${certificate?.gymnast?.lastName}</title>
            <style>
              body { 
                margin: 0; 
                padding: 20px; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh; 
                background: #f5f5f5; 
              }
              img { 
                max-width: 100%; 
                height: auto; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.1); 
              }
              @media print { 
                body { background: white; padding: 0; } 
                img { box-shadow: none; }
              }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="Certificate" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📜</div>
        <p>Loading certificate...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#dc3545' }}>⚠️</div>
        <h2 style={{ color: '#dc3545', marginBottom: '1rem' }}>Error</h2>
        <p style={{ marginBottom: '2rem', textAlign: 'center' }}>{error}</p>
        <button 
          onClick={() => navigate('/certificates')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back to Certificates
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '1rem 2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Certificate Preview</h1>
          {certificate && (
            <p style={{ margin: 0, color: '#666' }}>
              {certificate.gymnast.firstName} {certificate.gymnast.lastName} - Level {certificate.level.identifier}
            </p>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ← Back
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            🖨️ Print
          </button>
          <button
            onClick={handleDownload}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            📥 Download
          </button>
        </div>
      </div>

      {/* Certificate display */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '2rem'
      }}>
        {imageUrl ? (
          <img 
            src={imageUrl}
            alt="Certificate"
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              height: 'auto',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              border: '4px solid #d4af37'
            }}
          />
        ) : (
          <div style={{
            background: 'white',
            padding: '4rem',
            borderRadius: '8px',
            textAlign: 'center',
            border: '4px solid #d4af37'
          }}>
            <h2 style={{ color: '#333', marginBottom: '1rem' }}>Certificate Preview</h2>
            <p style={{ color: '#666' }}>Certificate image not available</p>
          </div>
        )}
      </div>

      {/* Certificate info footer */}
      {certificate && (
        <div style={{
          marginTop: '2rem',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '1rem 2rem',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <strong>Awarded:</strong> {new Date(certificate.awardedAt).toLocaleDateString()}
            </div>
            <div>
              <strong>Status:</strong> {certificate.status}
            </div>
            <div>
              <strong>Type:</strong> {certificate.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            {certificate.awardedBy && (
              <div>
                <strong>Awarded by:</strong> {certificate.awardedBy.firstName} {certificate.awardedBy.lastName}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificatePreview; 