import React from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const NOTIFICATION_LABELS = {
  SESSION_REMINDER: 'Session reminders — notified 5 minutes before a session starts',
};

export default function PushNotificationSettings() {
  const {
    supported,
    permissionState,
    isSubscribed,
    preferences,
    loading,
    subscribe,
    unsubscribe,
    updatePreference,
  } = usePushNotifications();

  if (!supported) {
    return (
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Push Notifications</h3>

      {permissionState === 'denied' && (
        <p style={{ color: '#b00', fontSize: '0.9rem' }}>
          Notifications are blocked. To enable them, update the permission in your browser or device settings.
        </p>
      )}

      {permissionState !== 'denied' && !isSubscribed && (
        <div>
          <p style={{ color: '#444', fontSize: '0.9rem' }}>
            Get notified about upcoming sessions and club updates.
          </p>
          <button onClick={subscribe} disabled={loading}>
            {loading ? 'Enabling...' : 'Enable notifications'}
          </button>
        </div>
      )}

      {isSubscribed && (
        <div>
          <p style={{ color: '#006600', fontSize: '0.9rem' }}>Notifications enabled.</p>
          <button onClick={unsubscribe} disabled={loading} style={{ marginBottom: '1rem' }}>
            {loading ? 'Disabling...' : 'Disable notifications'}
          </button>

          <div>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Notification types</strong>
            {Object.entries(NOTIFICATION_LABELS).map(([type, label]) => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={preferences[type] !== false}
                  onChange={(e) => updatePreference(type, e.target.checked)}
                />
                <span style={{ fontSize: '0.9rem' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
