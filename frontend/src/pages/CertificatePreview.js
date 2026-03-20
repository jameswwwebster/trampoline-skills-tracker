import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const CertificatePreview = () => {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const imageUrlRef = useRef(null);

  useEffect(() => {
    fetchCertificate();
    return () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, [certificateId]);

  const fetchCertificate = async () => {
    try {
      setLoading(true);

      const certificateResponse = await axios.get(`/api/certificates/${certificateId}`);
      const foundCertificate = certificateResponse.data;

      if (!foundCertificate) {
        setError('Certificate not found');
        return;
      }

      setCertificate(foundCertificate);

      const imageResponse = await axios.get(`/api/certificates/${certificateId}/preview`, {
        responseType: 'blob'
      });

      const url = URL.createObjectURL(imageResponse.data);
      imageUrlRef.current = url;
      setImageUrl(url);

    } catch (err) {
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
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cert-preview__error">
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-primary" onClick={() => navigate('/certificates')}>
          Back to Certificates
        </button>
      </div>
    );
  }

  return (
    <div className="cert-preview">
      <div className="cert-preview__header">
        <div>
          <h1 className="cert-preview__title">Certificate Preview</h1>
          {certificate && (
            <p className="cert-preview__subtitle">
              {certificate.gymnast.firstName} {certificate.gymnast.lastName} — Level {certificate.level.identifier}
            </p>
          )}
        </div>
        <div className="cert-preview__actions">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            &larr; Back
          </button>
          <button className="btn btn-outline" onClick={handlePrint}>
            Print
          </button>
          <button className="btn btn-primary" onClick={handleDownload}>
            Download
          </button>
        </div>
      </div>

      <div className="cert-preview__image-area">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Certificate"
            className="cert-preview__image"
          />
        ) : (
          <div className="cert-preview__no-image">
            <p>Certificate image not available</p>
          </div>
        )}
      </div>

      {certificate && (
        <div className="cert-preview__footer">
          <div className="cert-preview__footer-items">
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
