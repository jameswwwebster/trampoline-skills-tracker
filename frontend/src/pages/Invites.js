import React, { useState } from 'react';
import SendInviteForm from '../components/SendInviteForm';
import InviteList from '../components/InviteList';

const Invites = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleInviteSent = (invite) => {
    // Trigger refresh of invite list
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      <h1>Manage Invitations</h1>
      
      <div className="grid">
        <div>
          <SendInviteForm onInviteSent={handleInviteSent} />
        </div>
      </div>

      <InviteList refreshTrigger={refreshTrigger} />
    </div>
  );
};

export default Invites; 