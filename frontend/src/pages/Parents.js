import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Parents = () => {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user, isClubAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const fetchParents = async () => {
      try {
        // Fetch all users in the club and filter for parents
        const [usersResponse, gymnastsResponse] = await Promise.all([
          axios.get('/api/users'),
          axios.get('/api/gymnasts')
        ]);
        
        const allUsers = usersResponse.data;
        const allGymnasts = gymnastsResponse.data;
        
        // Filter for parents only
        const parentUsers = allUsers.filter(user => user.role === 'PARENT');
        
        // Add children information to each parent
        const parentsWithChildren = parentUsers.map(parent => {
          const children = allGymnasts.filter(gymnast => 
            gymnast.guardians.some(guardian => guardian.id === parent.id)
          );
          return {
            ...parent,
            children: children
          };
        });
        
        setParents(parentsWithChildren);
      } catch (error) {
        console.error('Failed to fetch parents:', error);
        setError('Failed to load parents data');
      } finally {
        setLoading(false);
      }
    };

    if (isClubAdmin) {
      fetchParents();
    } else {
      setError('Access denied. This page is only available for club administrators.');
      setLoading(false);
    }
  }, [isClubAdmin]);

  // Check for URL parameters to highlight specific parent
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && parents.length > 0) {
      const targetParent = parents.find(p => p.id === highlightId);
      if (targetParent) {
        setSearchTerm(`${targetParent.firstName} ${targetParent.lastName}`);
      }
    }
  }, [searchParams, parents]);

  // Filter parents based on search term
  const filteredParents = parents.filter(parent => {
    const search = searchTerm.toLowerCase();
    const parentName = `${parent.firstName} ${parent.lastName}`.toLowerCase();
    const parentEmail = parent.email.toLowerCase();
    const childrenNames = parent.children.map(child => 
      `${child.firstName} ${child.lastName}`.toLowerCase()
    ).join(' ');
    
    return parentName.includes(search) || 
           parentEmail.includes(search) || 
           childrenNames.includes(search);
  });

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

  if (!isClubAdmin) {
    return (
      <div className="alert alert-error">
        Access denied. This page is only available for club administrators.
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <h1>Parents & Guardians</h1>
      </div>

      <div className="info-message">
        <p>These are all the parents and guardians registered in your club: <strong>{user?.club?.name}</strong></p>
      </div>

      {/* Search Input */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <input
            type="text"
            placeholder="Search by parent name, email, or children's names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
            style={{ margin: 0 }}
          />
        </div>
      </div>

      {filteredParents.length === 0 ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No Parents Found</h3>
          </div>
          <div>
            {parents.length === 0 ? (
              <>
                <p>No parents have been registered in your club yet.</p>
                <p>Parents can join by accepting invitations or registering directly.</p>
              </>
            ) : (
              <p>No parents match your search criteria.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Club Parents ({filteredParents.length})</h3>
          </div>
          
          {/* Desktop Table */}
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Children</th>
                <th>Joined Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredParents.map(parent => (
                <tr key={parent.id}>
                  <td>
                    <strong>{parent.firstName} {parent.lastName}</strong>
                  </td>
                  <td>
                    {parent.email}
                  </td>
                  <td>
                    {parent.children.length > 0 ? (
                      <div>
                        {parent.children.map(child => (
                          <div key={child.id}>
                            <Link 
                              to={`/gymnasts?highlight=${child.id}`}
                              className="text-link"
                            >
                              <small>{child.firstName} {child.lastName}</small>
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">No children</span>
                    )}
                  </td>
                  <td>
                    {new Date(parent.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className="badge badge-success">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="mobile-table-cards">
            {filteredParents.map(parent => (
              <div key={parent.id} className="mobile-table-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">
                    {parent.firstName} {parent.lastName}
                  </div>
                  <div className="mobile-card-actions">
                    <span className="badge badge-success">Active</span>
                  </div>
                </div>
                
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Email:</span>
                    <span className="mobile-card-value">
                      {parent.email}
                    </span>
                  </div>
                  
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Children:</span>
                    <span className="mobile-card-value">
                      {parent.children.length > 0 ? (
                        <div>
                          {parent.children.map(child => (
                            <div key={child.id} style={{ fontSize: '0.9rem' }}>
                              <Link 
                                to={`/gymnasts?highlight=${child.id}`}
                                className="text-link"
                              >
                                {child.firstName} {child.lastName}
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">No children</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Joined:</span>
                    <span className="mobile-card-value">
                      {new Date(parent.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Parents; 