/**
 * Normalizes API responses to handle both standardized and legacy formats
 * 
 * Standardized format: { success: true, data: [...] }
 * Legacy format: { data: [...] } or direct array [...]
 * 
 * @param {any} response - The API response object (Axios response or direct data)
 * @param {any} defaultValue - Value to return if response is invalid (default: [])
 * @returns {any} Normalized data array
 */
export const normalizeApiResponse = (response, defaultValue = []) => {
  // Handle null/undefined
  if (!response) {
    console.warn('[normalizeApiResponse] Received null or undefined response');
    return defaultValue;
  }

  // Axios response object usually has data property
  const responseData = response.data !== undefined ? response.data : response;

  // Handle standardized envelope format: { success: true, data: [...] }
  if (responseData && responseData.success === true && Array.isArray(responseData.data)) {
    return responseData.data;
  }

  // Handle common envelope format: { data: [...] } 
  if (responseData && responseData.data && Array.isArray(responseData.data)) {
    return responseData.data;
  }

  // Handle direct array
  if (Array.isArray(responseData)) {
    return responseData;
  }

  // Fallback for empty or unexpected structure
  if (responseData && typeof responseData === 'object' && Object.keys(responseData).length === 0) {
    return defaultValue;
  }

  console.warn('[normalizeApiResponse] Unexpected response format:', response);
  return defaultValue;
};
