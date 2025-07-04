import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Gymnasts = () => {
  const [gymnasts, setGymnasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        <button className="btn btn-primary">
          Add New Gymnast
        </button>
      </div>

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
                <th>Guardians</th>
                <th>Progress</th>
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
                    {gymnast.guardians.length > 0 ? (
                      <div>
                        {gymnast.guardians.map(guardian => (
                          <div key={guardian.id}>
                            {guardian.firstName} {guardian.lastName}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>No guardians</span>
                    )}
                  </td>
                  <td>
                    <div>
                      <small>
                        Skills: {gymnast._count.skillProgress} | 
                        Levels: {gymnast._count.levelProgress}
                      </small>
                    </div>
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