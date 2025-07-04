import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import CreateClubForm from '../components/CreateClubForm';

const Dashboard = () => {
  const { user, isClubAdmin, updateUser } = useAuth();

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
            <p>Welcome to the Trampoline Tracker! Use the navigation above to:</p>
            <ul>
              <li>View and manage trampoline levels</li>
              {(isClubAdmin || user?.role === 'COACH') && (
                <li>Manage gymnasts and track their progress</li>
              )}
              {user?.role === 'PARENT' && (
                <li>View your child's progress</li>
              )}
            </ul>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 