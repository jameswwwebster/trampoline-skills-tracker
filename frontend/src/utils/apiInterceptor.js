import axios from 'axios';

let rateLimitContext = null;

// Set the rate limit context from the app
export const setRateLimitContext = (context) => {
  rateLimitContext = context;
};

// Create a custom axios instance with interceptors
const apiClient = axios.create({
  // Only set baseURL for production - in development, the proxy handles routing
  baseURL: process.env.NODE_ENV === 'production' ? process.env.REACT_APP_API_URL : undefined
});

// Request interceptor to add authorization header and check rate limiting
apiClient.interceptors.request.use(
  (config) => {
    // Add authorization header from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
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
      // Ensure the banner is visible by triggering rate limiting if not already active
      if (rateLimitContext && !rateLimitContext.isRateLimited) {
        rateLimitContext.handleRateLimitHit(error.retryAfterSeconds || error.retryAfter);
      }
      // Don't show additional error messages for rate limited requests - the banner handles this
      throw new Error(`Request blocked due to rate limiting. Please check the banner at the top of the page.`);
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