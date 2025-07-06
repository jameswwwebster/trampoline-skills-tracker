import axios from 'axios';

let rateLimitContext = null;

// Set the rate limit context from the app
export const setRateLimitContext = (context) => {
  rateLimitContext = context;
};

// Create a custom axios instance with interceptors
const apiClient = axios.create();

// Request interceptor to check rate limiting
apiClient.interceptors.request.use(
  (config) => {
    // Check if we can make requests
    if (rateLimitContext && !rateLimitContext.canMakeRequest()) {
      const error = new Error('Rate limited - requests are currently blocked');
      error.isRateLimited = true;
      error.retryAfter = rateLimitContext.retryAfter;
      return Promise.reject(error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 429 errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 429) {
      // Extract retry-after header if available
      const retryAfter = error.response.headers['retry-after'];
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : null;
      
      // Trigger rate limiting
      if (rateLimitContext) {
        rateLimitContext.handleRateLimitHit(retryAfterSeconds);
      }
      
      // Enhance error with rate limiting info
      error.isRateLimited = true;
      error.retryAfterSeconds = retryAfterSeconds;
    }
    
    return Promise.reject(error);
  }
);

// Utility function to make API calls with rate limiting
export const makeApiCall = async (requestFn) => {
  try {
    return await requestFn(apiClient);
  } catch (error) {
    if (error.isRateLimited) {
      // Don't show additional error messages for rate limited requests
      throw new Error(`Request blocked due to rate limiting. Please wait ${error.retryAfter || 'a moment'} before trying again.`);
    }
    throw error;
  }
};

// Wrapper functions for common HTTP methods
export const get = (url, config = {}) => {
  return makeApiCall((client) => client.get(url, config));
};

export const post = (url, data = {}, config = {}) => {
  return makeApiCall((client) => client.post(url, data, config));
};

export const put = (url, data = {}, config = {}) => {
  return makeApiCall((client) => client.put(url, data, config));
};

export const patch = (url, data = {}, config = {}) => {
  return makeApiCall((client) => client.patch(url, data, config));
};

export const del = (url, config = {}) => {
  return makeApiCall((client) => client.delete(url, config));
};

// Default export for the configured axios instance
export default apiClient; 