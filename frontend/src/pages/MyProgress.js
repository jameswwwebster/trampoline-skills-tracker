import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import GymnastProgress from '../components/GymnastProgress';

const MyProgress = () => {
  const { user, isAdult, isChild } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gymnasts, setGymnasts] = useState([]);
  const [selectedGymnast, setSelectedGymnast] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (isChild) {
          setSelectedGymnast({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            club: user.club
          });
        } else if (isAdult) {
          const response = await axios.get('/api/gymnasts/my-children');
          const myGymnasts = response.data;

          if (myGymnasts.length === 0) {
            setError('No gymnasts found. You may not be registered as a guardian for any gymnasts. Please contact your club administrator to be added as a guardian.');
          } else if (myGymnasts.length === 1) {
            setSelectedGymnast(myGymnasts[0]);
          } else {
            setGymnasts(myGymnasts);
          }
        } else {
          setError('Access denied.');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch gymnast data:', error);
        setError('Failed to load progress data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, isAdult, isChild]);

  const handleGymnastSelect = (gymnast) => {
    setSelectedGymnast(gymnast);
  };

  const handleBackToGymnasts = () => {
    setSelectedGymnast(null);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <h3>Unable to Load Progress</h3>
        <p>{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Show specific gymnast's progress
  if (selectedGymnast) {
    return (
      <div>
        {gymnasts.length > 1 && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={handleBackToGymnasts}
              className="btn btn-outline"
            >
              ← Back
            </button>
          </div>
        )}
        <GymnastProgress gymnastId={selectedGymnast.id} />
      </div>
    );
  }

  // Show gymnast selection for adults with multiple gymnasts
  if (isAdult && gymnasts.length > 1) {
    return (
      <div>
        <h1>Progress</h1>
        <p>Select a gymnast to view their progress:</p>

        <div className="grid">
          {gymnasts.map(gymnast => (
            <div key={gymnast.id} className="card">
              <div className="card-header">
                <h3 className="card-title">
                  {gymnast.firstName} {gymnast.lastName}
                </h3>
              </div>
              <div>
                <p>
                  <strong>Date of Birth:</strong>{' '}
                  {gymnast.dateOfBirth
                    ? new Date(gymnast.dateOfBirth).toLocaleDateString()
                    : 'Not specified'
                  }
                </p>
                <p>
                  <strong>Completed Skills:</strong> {gymnast.completedSkillsCount || 0}
                </p>
                <p>
                  <strong>Completed Levels:</strong> {gymnast.completedLevelsCount || 0}
                </p>

                <button
                  onClick={() => handleGymnastSelect(gymnast)}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  View Progress
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback - should not reach here
  return (
    <div className="alert alert-info">
      <p>No progress data available.</p>
    </div>
  );
};

export default MyProgress; 