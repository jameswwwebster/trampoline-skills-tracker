/**
 * Utility functions for handling API errors and displaying user-friendly messages
 */

/**
 * Get a user-friendly error message based on the error response
 * @param {Object} error - The error object from axios
 * @param {string} fallbackMessage - Default message if no specific handling is found
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error, fallbackMessage = 'An unexpected error occurred') => {
  // Handle network errors
  if (error.code === 'NETWORK_ERROR' || !error.response) {
    return 'Network error. Please check your internet connection and try again.';
  }

  const status = error.response?.status;
  const responseError = error.response?.data?.error;

  switch (status) {
    case 400:
      return responseError || 'Invalid request. Please check your input and try again.';
    
    case 401:
      return 'Your session has expired. Please log in again.';
    
    case 403:
      return 'You don\'t have permission to perform this action.';
    
    case 404:
      return responseError || 'The requested resource was not found.';
    
    case 409:
      return responseError || 'This action conflicts with existing data.';
    
    case 422:
      return responseError || 'Please check your input and correct any validation errors.';
    
    case 429:
      return 'You\'re making too many requests. Please wait a moment before trying again. 🚦';
    
    case 500:
      return 'Server error. Please try again later or contact support if the problem persists.';
    
    case 502:
    case 503:
    case 504:
      return 'Service is temporarily unavailable. Please try again in a few minutes.';
    
    default:
      return responseError || error.message || fallbackMessage;
  }
};

/**
 * Handle common error responses and display appropriate messages
 * @param {Object} error - The error object from axios
 * @param {Function} setError - Function to set error state
 * @param {string} fallbackMessage - Default message if no specific handling is found
 */
export const handleApiError = (error, setError, fallbackMessage) => {
  const message = getErrorMessage(error, fallbackMessage);
  setError(message);
  
  // Log the full error for debugging
  console.error('API Error:', error);
  
  // Handle 401 errors by redirecting to login
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    delete window.axios?.defaults?.headers?.common?.['Authorization'];
    
    // Redirect to login after a short delay to allow user to see the message
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  }
};

/**
 * Check if an error is a rate limit error
 * @param {Object} error - The error object from axios
 * @returns {boolean} True if it's a 429 error
 */
export const isRateLimitError = (error) => {
  return error.response?.status === 429;
};

/**
 * Get the retry-after value from a 429 response
 * @param {Object} error - The error object from axios
 * @returns {number|null} Seconds to wait before retrying, or null if not specified
 */
export const getRetryAfter = (error) => {
  if (!isRateLimitError(error)) return null;
  
  const retryAfter = error.response?.headers?.[`retry-after`];
  return retryAfter ? parseInt(retryAfter, 10) : null;
};

/**
 * Format a rate limit error message with optional retry time
 * @param {Object} error - The error object from axios
 * @returns {string} Formatted rate limit message
 */
export const formatRateLimitMessage = (error) => {
  const retryAfter = getRetryAfter(error);
  
  if (retryAfter) {
    if (retryAfter < 60) {
      return `You're making too many requests. Please wait ${retryAfter} seconds before trying again. 🚦`;
    } else {
      const minutes = Math.ceil(retryAfter / 60);
      return `You're making too many requests. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again. 🚦`;
    }
  }
  
  return 'You\'re making too many requests. Please wait a moment before trying again. 🚦';
}; 