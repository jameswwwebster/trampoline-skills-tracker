import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import CertificateDisplay from '../components/CertificateDisplay';

const MyCertificates = () => {
  // const [certificates, setCertificates] = useState([]); // Not used currently
  const [gymnasts, setGymnasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGymnast, setSelectedGymnast] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (user?.role === 'PARENT') {
        // For parents, fetch all their children's certificates
        const gymnastsResponse = await axios.get('/api/gymnasts');
        const allGymnasts = gymnastsResponse.data;
        
        // Filter to only gymnasts that this parent is guardian for
        const myGymnasts = allGymnasts.filter(gymnast => 
          gymnast.guardians.some(guardian => guardian.id === user.id)
        );
        setGymnasts(myGymnasts);
        
        // If there's only one gymnast, select them automatically
        if (myGymnasts.length === 1) {
          setSelectedGymnast(myGymnasts[0]);
        }
      } else if (user?.role === 'GYMNAST') {
        // For gymnasts, find their own gymnast record
        const gymnastsResponse = await axios.get('/api/gymnasts');
        const allGymnasts = gymnastsResponse.data;
        
        const myGymnastRecord = allGymnasts.find(gymnast => gymnast.userId === user.id);
        if (myGymnastRecord) {
          setGymnasts([myGymnastRecord]);
          setSelectedGymnast(myGymnastRecord);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch certificates');
    } finally {
      setLoading(false);
    }
  };

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

  if (error) {
    return (
      <div className="container">
        <div className="alert alert-danger">
          <h4>Error</h4>
          <p>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (gymnasts.length === 0) {
    return (
      <div className="container">
        <div className="page-header">
          <h1>My Certificates</h1>
        </div>
        <div className="alert alert-info">
          <h4>No Gymnasts Found</h4>
          <p>
            {user?.role === 'PARENT' 
              ? 'No gymnasts found that you are guardian for. Please contact your club administrator if this is incorrect.'
              : 'No gymnast profile found for your account. Please contact your club administrator.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>My Certificates</h1>
        <p>View and download your certificates</p>
      </div>

      {/* Gymnast Selection for Parents with Multiple Children */}
      {user?.role === 'PARENT' && gymnasts.length > 1 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title">Select Gymnast</h5>
          </div>
          <div className="card-body">
            <div className="row">
              {gymnasts.map(gymnast => (
                <div key={gymnast.id} className="col-md-3 mb-3">
                  <div 
                    className={`card ${selectedGymnast?.id === gymnast.id ? 'border-primary' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedGymnast(gymnast)}
                  >
                    <div className="card-body text-center">
                      <h6 className="card-title">
                        {gymnast.firstName} {gymnast.lastName}
                      </h6>
                      {gymnast.dateOfBirth && (
                        <small className="text-muted">
                          Born: {new Date(gymnast.dateOfBirth).toLocaleDateString()}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Certificate Display */}
      {selectedGymnast ? (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title">
              Certificates for {selectedGymnast.firstName} {selectedGymnast.lastName}
            </h5>
          </div>
          <div className="card-body">
            <CertificateDisplay 
              gymnastId={selectedGymnast.id} 
              showActions={false}
            />
          </div>
        </div>
      ) : (
        <div className="alert alert-info">
          <h4>Select a Gymnast</h4>
          <p>Please select a gymnast from above to view their certificates.</p>
        </div>
      )}
    </div>
  );
};

export default MyCertificates; 