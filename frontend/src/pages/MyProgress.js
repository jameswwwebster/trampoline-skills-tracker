import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import GymnastProgress from '../components/GymnastProgress';

const MyProgress = () => {
  const { user, isParent } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!isParent) {
          setError('Access denied. This page is only available for parents and guardians.');
          return;
        }

        // For parents, get their children using the dedicated endpoint
        const response = await axios.get('/api/gymnasts/my-children');
        const myChildren = response.data;

        if (myChildren.length === 0) {
          setError('No children found. You may not be registered as a guardian for any gymnasts. Please contact your club administrator to be added as a guardian.');
        } else if (myChildren.length === 1) {
          // If only one child, show their progress directly
          setSelectedChild(myChildren[0]);
        } else {
          // Multiple children, show selection
          setChildren(myChildren);
        }
      } catch (error) {
        console.error('Failed to fetch gymnast data:', error);
        setError('Failed to load progress data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, isParent]);

  const handleChildSelect = (child) => {
    setSelectedChild(child);
  };

  const handleBackToChildren = () => {
    setSelectedChild(null);
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

  // Show specific child's progress
  if (selectedChild) {
    return (
      <div>
        {children.length > 1 && (
          <div style={{ marginBottom: '1rem' }}>
            <button 
              onClick={handleBackToChildren}
              className="btn btn-outline"
            >
              ← Back to Children
            </button>
          </div>
        )}
        <GymnastProgress gymnastId={selectedChild.id} />
      </div>
    );
  }

  // Show children selection for parents with multiple children
  if (isParent && children.length > 1) {
    return (
      <div>
        <h1>Children's Progress</h1>
        <p>Select a child to view their progress:</p>
        
        <div className="grid">
          {children.map(child => (
            <div key={child.id} className="card">
              <div className="card-header">
                <h3 className="card-title">
                  {child.firstName} {child.lastName}
                </h3>
              </div>
              <div>
                <p>
                  <strong>Date of Birth:</strong>{' '}
                  {child.dateOfBirth 
                    ? new Date(child.dateOfBirth).toLocaleDateString()
                    : 'Not specified'
                  }
                </p>
                <p>
                  <strong>Completed Skills:</strong> {child.completedSkillsCount || 0}
                </p>
                <p>
                  <strong>Completed Levels:</strong> {child.completedLevelsCount || 0}
                </p>
                
                <button 
                  onClick={() => handleChildSelect(child)}
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