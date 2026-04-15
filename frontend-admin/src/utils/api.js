import axios from "axios";

// Create an instance of axios with base configurations
const api = axios.create({
  baseURL: "/", // Vite proxy handles this or relative paths work fine
  headers: {
    "Accept": "application/json",
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach Authorization header
api.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user && user.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
      } catch (e) {
        console.error("API Utils: Failed to parse user for token", e);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors (e.g., 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token might be expired or invalid
      console.warn("API 401: Unauthorized. Clearing session...");
      localStorage.removeItem("user");
      // Optional: window.location.href = "/login";
    }
    
    if (error.response && error.response.status === 429) {
      console.error("API 429: Too Many Requests. Rate limit hit.");
    }

    return Promise.reject(error);
  }
);

export default api;
