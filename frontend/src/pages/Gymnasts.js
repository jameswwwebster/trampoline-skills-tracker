import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AddGymnastForm from '../components/AddGymnastForm';

const Gymnasts = () => {
  const [gymnasts, setGymnasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const fetchGymnasts = async () => {
      try {
        const response = await axios.get('/api/gymnasts');
        setGymnasts(response.data);
      } catch (error) {
        console.error('Failed to fetch gymnasts:', error);
        setError('Failed to load gymnasts');
      } finally {
        setLoading(false);
      }
    };

    fetchGymnasts();
  }, []);

  const handleAddSuccess = (newGymnast) => {
    setGymnasts(prev => [...prev, newGymnast]);
    setShowAddForm(false);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
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
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <h1>Gymnasts</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add New Gymnast'}
        </button>
      </div>

      {showAddForm && (
        <AddGymnastForm 
          onSuccess={handleAddSuccess}
          onCancel={handleCancelAdd}
        />
      )}

      {gymnasts.length === 0 ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No Gymnasts Found</h3>
          </div>
          <div>
            <p>No gymnasts have been added to your club yet.</p>
            <p>Click "Add New Gymnast" to get started.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Club Gymnasts</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date of Birth</th>
                <th>Current Level</th>
                <th>Progress</th>
                <th>Guardians</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gymnasts.map(gymnast => (
                <tr key={gymnast.id}>
                  <td>
                    <strong>{gymnast.firstName} {gymnast.lastName}</strong>
                  </td>
                  <td>
                    {gymnast.dateOfBirth 
                      ? new Date(gymnast.dateOfBirth).toLocaleDateString()
                      : 'Not specified'
                    }
                  </td>
                  <td>
                    {gymnast.currentLevel ? (
                      <div>
                        <span className="level-badge">
                          Level {gymnast.currentLevel.number}
                        </span>
                        <br />
                        <small className="text-muted">
                          {gymnast.currentLevel.name}
                        </small>
                        {gymnast.workingLevel && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <span className="badge badge-warning">
                              Working on {gymnast.workingLevel.number}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {gymnast.workingLevel ? (
                          <div>
                            <span className="badge badge-warning">
                              Starting Level {gymnast.workingLevel.number}
                            </span>
                            <br />
                            <small className="text-muted">
                              {gymnast.workingLevel.name}
                            </small>
                          </div>
                        ) : (
                          <span className="badge badge-secondary">
                            Not started
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="progress-stats">
                      <div className="stat-item">
                        <div className="stat-number">{gymnast.completedSkillsCount}</div>
                        <div className="stat-label">Skills</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-number">{gymnast.completedLevelsCount}</div>
                        <div className="stat-label">Levels</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {gymnast.guardians.length > 0 ? (
                      <div>
                        {gymnast.guardians.map(guardian => (
                          <div key={guardian.id}>
                            <small>{guardian.firstName} {guardian.lastName}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">No guardians</span>
                    )}
                  </td>
                  <td>
                    <div className="flex">
                      <Link 
                        to={`/progress/${gymnast.id}`}
                        className="btn btn-sm btn-primary"
                      >
                        View Progress
                      </Link>
                      <button className="btn btn-sm btn-outline">
                        Edit
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
  );
};

export default Gymnasts; 