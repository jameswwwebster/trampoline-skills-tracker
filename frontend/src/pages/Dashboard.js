import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CreateClubForm from '../components/CreateClubForm';

const Dashboard = () => {
  const { user, isClubAdmin, isParent, updateUser } = useAuth();

  const handleClubCreated = (club, updatedUser) => {
    // Update the user context with the new club information
    updateUser(updatedUser);
  };

  // Show club creation form for club admins without a club
  if (isClubAdmin && !user?.club) {
    return (
      <div>
        <h1>Welcome, {user?.firstName}!</h1>
        <CreateClubForm onClubCreated={handleClubCreated} />
      </div>
    );
  }

  return (
    <div>
      <h1>Welcome, {user?.firstName}!</h1>
      
      <div className="grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Club Information</h3>
          </div>
          <div>
            <p><strong>Club:</strong> {user?.club?.name || 'No club assigned'}</p>
            <p><strong>Your Role:</strong> {user?.role?.replace('_', ' ')}</p>
            {user?.club?.address && (
              <p><strong>Address:</strong> {user.club.address}</p>
            )}
            {user?.club?.phone && (
              <p><strong>Phone:</strong> {user.club.phone}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div>
            <p>Welcome to the Trampoline Tracker!</p>
            
            {isParent && (
              <div style={{ marginTop: '1rem' }}>
                <Link to="/my-progress" className="btn btn-primary">
                  📊 View My Children's Progress
                </Link>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Monitor your children's skill development and achievements
                </p>
              </div>
            )}
            
            {(isClubAdmin || user?.role === 'COACH') && (
              <div style={{ marginTop: '1rem' }}>
                <Link to="/gymnasts" className="btn btn-primary">
                  Manage Gymnasts
                </Link>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                  Track and update gymnast progress
                </p>
              </div>
            )}
            
            <div style={{ marginTop: '1.5rem' }}>
              <h4>Navigation Options:</h4>
              <ul>
                <li>
                  <Link to="/levels">View and explore trampoline levels</Link>
                </li>
                {(isClubAdmin || user?.role === 'COACH') && (
                  <li>
                    <Link to="/competitions">Manage competitions</Link>
                  </li>
                )}
                {isClubAdmin && (
                  <li>
                    <Link to="/invites">Send invitations to new users</Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Getting Started</h3>
          </div>
          <div>
            <p>This system tracks gymnast progress through trampoline skill levels.</p>
            <p>There are 10 sequential levels plus additional side paths for specialized training.</p>
            <p>Each level contains specific skills and routine requirements.</p>
            
            {isParent && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h4 style={{ color: '#495057', marginBottom: '0.5rem' }}>👪 For Parents:</h4>
                <ul style={{ marginBottom: '0' }}>
                  <li>Use <strong>"Children's Progress"</strong> to view your child's skill development</li>
                  <li>See which skills they've mastered and what they're working on next</li>
                  <li>Track their progression through the 10 trampoline levels</li>
                  <li>Monitor their competition eligibility as they advance</li>
                  <li>View their complete progress history and achievements</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 