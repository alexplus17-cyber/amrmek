import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Make sure to have API_URL in your .env file.
// For the emulator use the host mapping 10.0.2.2 so Android can reach the host's
// localhost. Use the WP REST root so endpoints like '/investor-network/v1/...' work.
const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://10.0.2.2/word/wp-json';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Interceptor Setup ---
// This setup function allows us to inject the signOut function from our Auth context
// without creating a circular dependency between the api service and the context.
export const setupInterceptors = (signOut: () => void) => {
  api.interceptors.response.use(
    (response) => response, // Directly return successful responses
    async (error) => {
      // Helpful debug output for network failures
      try {
        // axios error may not be JSON serializable directly in all environments
        console.error('API response error:', error?.message);
        if (error?.toJSON) console.error('Error details:', error.toJSON());
        if (error?.response) console.error('Response status/data:', error.response.status, error.response.data);
      } catch (logErr) {
        console.error('Failed to log axios error', logErr);
      }
      const originalRequest = error.config;
      // Check for 401 error and ensure it's not a retry request
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true; // Mark as retried
        
        try {
          const refreshToken = await SecureStore.getItemAsync('refreshToken');
          if (!refreshToken) {
            // If no refresh token, sign out and reject
            signOut();
            return Promise.reject(error);
          }
          
          // Make a request to the refresh token endpoint
          const { data } = await api.post('/jwt-auth/v1/token/refresh', {
            refresh_token: refreshToken,
          });

          const newAuthToken = data.token;
          // Store the new auth token
          await SecureStore.setItemAsync('authToken', newAuthToken);
          
          // Update the authorization header for the original request
          originalRequest.headers.Authorization = `Bearer ${newAuthToken}`;
          
          // Retry the original request with the new token
          return api(originalRequest);

        } catch (refreshError) {
          // If the refresh token request fails, sign out the user
          console.error('Token refresh failed:', refreshError);
          signOut();
          return Promise.reject(refreshError);
        }
      }
      
      // For all other errors, just reject the promise
      return Promise.reject(error);
    }
  );
};


// Request interceptor to add the token to headers
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- API Functions ---

// Auth
export const login = (username: string, password: string) => 
  api.post('/jwt-auth/v1/token', { username, password });

// Listings
export const getListings = () => api.get('/investor-network/v1/listings');
export const getListingDetails = (id: number) => api.get(`/investor-network/v1/listings/${id}`);
export const getListingAvailability = (id: number) => api.get(`/investor-network/v1/listings/${id}/availability`);

// Payments
export const createPaymentIntent = (listingId: number, quantity: number) =>
  api.post('/investor-network/v1/stripe/create-payment-intent', { listingId, quantity });

export const recordPurchase = (listingId: number, quantity: number, paymentMethod: string, paymentPayload: object) =>
  // Defensive: coerce quantity to integer and ensure payload shape matches server expectation
  api.post(`/investor-network/v1/listings/${listingId}/purchase`, {
    quantity: Number(quantity) || 0,
    payment_method: String(paymentMethod || '').toLowerCase(),
    payment_payload: paymentPayload || {},
  });


// Invoices
export const getInvoices = () => api.get('/investor-network/v1/invoices');
export const markInvoiceAsPaid = (invoiceId: string) => 
  api.post(`/investor-network/v1/invoices/${invoiceId}/mark-paid`);

export const uploadReceipt = (invoiceId: string, receiptUri: string, comment: string) => {
  const formData = new FormData();
  
  // The backend expects a file. The name and type are important.
  const uriParts = receiptUri.split('.');
  const fileType = uriParts[uriParts.length - 1];
  
  // FIX: Cast the file object to 'any' to accommodate React Native's FormData polyfill,
  // which uses a specific object structure { uri, name, type } for file uploads,
  // resolving the TypeScript type mismatch with the standard FormData definition.
  formData.append('receipt', {
    uri: receiptUri,
    name: `receipt-${invoiceId}.${fileType}`,
    type: `image/${fileType}`,
  } as any);

  if (comment) {
    formData.append('comment', comment);
  }
  
  // Axios will automatically set the 'Content-Type' to 'multipart/form-data'
  // when you pass a FormData object.
  return api.post(`/investor-network/v1/invoices/${invoiceId}/upload-receipt`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};


// Bank Details
export const getBankDetails = () => api.get('/investor-network/v1/bank-details');

// User Profile
export const getUserProfile = () => api.get('/investor-network/v1/members/me');

// Member dashboard (mobile)
export const getMemberDashboard = () => api.get('/investor-network/v1/members/me/dashboard');

export const updateUserProfile = async (profileData: { email?: string; fullName?: string; bio?: string; id?: number }) => {
  // The REST endpoint expects a numeric member ID for updates. If caller doesn't
  // provide an id, fetch the current member via `/members/me` to obtain it.
  let memberId: number | undefined = profileData.id as any;
  if (!memberId) {
    const meResp = await api.get('/investor-network/v1/members/me');
    memberId = meResp?.data?.id;
  }
  if (!memberId) {
    throw new Error('Unable to determine member id for profile update');
  }
  return api.post(`/investor-network/v1/members/${memberId}`, profileData);
};

// User Settings
export const getUserSettings = () => api.get('/investor-network/v1/settings');
export const updateUserSettings = (settingsData: any) =>
    api.post('/investor-network/v1/settings', settingsData);

// Push Notifications
import { Platform } from 'react-native';

export const registerDeviceToken = (token: string) => 
  api.post('/investor-network/v1/device-token', { token, platform: Platform.OS });


export default api;