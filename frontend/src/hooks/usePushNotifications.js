import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * Converts a base64url-encoded VAPID public key to the Uint8Array
 * format required by pushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Manages the Web Push subscription lifecycle and per-type preferences.
 *
 * Returns:
 *  - supported: boolean — false on browsers that don't support push
 *  - permissionState: 'default' | 'granted' | 'denied'
 *  - isSubscribed: boolean
 *  - preferences: { SESSION_REMINDER: boolean }
 *  - loading: boolean
 *  - subscribe(): Promise<void>
 *  - unsubscribe(): Promise<void>
 *  - updatePreference(type, enabled): Promise<void>
 */
export function usePushNotifications() {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [permissionState, setPermissionState] = useState(
    supported ? Notification.permission : 'denied'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState({ SESSION_REMINDER: true });
  const [loading, setLoading] = useState(false);

  // On mount, check if there is already an active subscription
  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, [supported]);

  // Fetch current preferences from the server when subscribed
  useEffect(() => {
    if (!isSubscribed) return;
    axios
      .get('/api/push/preferences')
      .then((res) => setPreferences(res.data))
      .catch(() => {});
  }, [isSubscribed]);

  const subscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission !== 'granted') return;

      const { data } = await axios.get('/api/push/vapid-public-key');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      await axios.post('/api/push/subscribe', sub.toJSON());
      setIsSubscribed(true);
    } catch (err) {
      console.error('Push subscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await axios.delete('/api/push/subscribe', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreference = useCallback(async (type, enabled) => {
    try {
      await axios.patch('/api/push/preferences', { notificationType: type, enabled });
      setPreferences((prev) => ({ ...prev, [type]: enabled }));
    } catch (err) {
      console.error('Preference update error:', err);
    }
  }, []);

  return {
    supported,
    permissionState,
    isSubscribed,
    preferences,
    loading,
    subscribe,
    unsubscribe,
    updatePreference,
  };
}
