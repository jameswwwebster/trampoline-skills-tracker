import React from 'react';
import { useRateLimit } from '../contexts/RateLimitContext';
import './RateLimitBanner.css';

const RateLimitBanner = () => {
  const { isRateLimited, retryAfter, consecutiveHits, formatTimeRemaining, dismissBanner } = useRateLimit();

  if (!isRateLimited) {
    return null;
  }

  return (
    <div className="rate-limit-banner">
      <div className="rate-limit-banner-content">
        <div className="rate-limit-banner-icon">
          ⚠️
        </div>
        <div className="rate-limit-banner-message">
          <h4>Rate Limit Exceeded</h4>
          <p>
            Too many requests have been sent. Please wait {formatTimeRemaining(retryAfter)} before making more requests.
          </p>
          {consecutiveHits > 1 && (
            <p className="rate-limit-banner-warning">
              This is attempt #{consecutiveHits}. Continued requests will result in longer delays.
            </p>
          )}
        </div>
        <div className="rate-limit-banner-countdown">
          <div className="countdown-circle">
            <span className="countdown-number">{retryAfter}</span>
          </div>
        </div>
        <button 
          className="rate-limit-banner-dismiss"
          onClick={dismissBanner}
          title="Dismiss banner (rate limiting still active)"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default RateLimitBanner; 