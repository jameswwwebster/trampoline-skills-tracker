import React, { createContext, useContext, useState, useEffect } from 'react';

const RateLimitContext = createContext();

export const useRateLimit = () => {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error('useRateLimit must be used within a RateLimitProvider');
  }
  return context;
};

export const RateLimitProvider = ({ children }) => {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [backoffTime, setBackoffTime] = useState(0);
  const [retryAfter, setRetryAfter] = useState(0);
  const [consecutiveHits, setConsecutiveHits] = useState(0);
  const [lastHitTime, setLastHitTime] = useState(0);

  // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)
  const calculateBackoffTime = (hitCount) => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 60 seconds
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, hitCount), maxDelay);
    return exponentialDelay;
  };

  // Reset consecutive hits if enough time has passed
  useEffect(() => {
    const resetTimer = setInterval(() => {
      const now = Date.now();
      // Reset consecutive hits if it's been more than 5 minutes since last hit
      if (consecutiveHits > 0 && now - lastHitTime > 300000) {
        setConsecutiveHits(0);
      }
    }, 60000); // Check every minute

    return () => clearInterval(resetTimer);
  }, [consecutiveHits, lastHitTime]);

  // Countdown timer for backoff
  useEffect(() => {
    if (isRateLimited && backoffTime > 0) {
      const countdown = setInterval(() => {
        setBackoffTime(prev => {
          if (prev <= 1000) {
            setIsRateLimited(false);
            setRetryAfter(0);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => clearInterval(countdown);
    }
  }, [isRateLimited, backoffTime]);

  const handleRateLimitHit = (retryAfterSeconds = null) => {
    const now = Date.now();
    
    // Update consecutive hits
    const newConsecutiveHits = consecutiveHits + 1;
    setConsecutiveHits(newConsecutiveHits);
    setLastHitTime(now);

    // Calculate backoff time
    let backoffMs;
    if (retryAfterSeconds) {
      // Use server-provided retry-after if available
      backoffMs = retryAfterSeconds * 1000;
    } else {
      // Use exponential backoff
      backoffMs = calculateBackoffTime(newConsecutiveHits - 1);
    }

    setBackoffTime(backoffMs);
    setRetryAfter(Math.ceil(backoffMs / 1000));
    setIsRateLimited(true);

    console.warn(`Rate limit hit. Backing off for ${Math.ceil(backoffMs / 1000)} seconds. Consecutive hits: ${newConsecutiveHits}`);
  };

  const canMakeRequest = () => {
    return !isRateLimited;
  };

  const formatTimeRemaining = (seconds) => {
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  };

  const dismissBanner = () => {
    // Allow manual dismissal but keep the rate limiting active
    setIsRateLimited(false);
  };

  const value = {
    isRateLimited,
    backoffTime,
    retryAfter,
    consecutiveHits,
    handleRateLimitHit,
    canMakeRequest,
    formatTimeRemaining,
    dismissBanner
  };

  return (
    <RateLimitContext.Provider value={value}>
      {children}
    </RateLimitContext.Provider>
  );
}; 