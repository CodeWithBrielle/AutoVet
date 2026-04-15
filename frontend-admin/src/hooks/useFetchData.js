import { useState, useEffect, useCallback } from 'react';
import { normalizeApiResponse } from '../utils/apiResponseNormalizer';

/**
 * Custom hook for fetching and normalizing API data
 * Designed for AutoVet Phase 3 stability requirements.
 * 
 * @param {Function} apiCall - Function that returns a promise with API response
 * @param {Array} dependencies - useEffect dependency array
 * @returns {Object} { data, loading, error, refresh }
 */
export const useFetchData = (apiCall, dependencies = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiCall();
      const normalizedData = normalizeApiResponse(response);
      setData(normalizedData);
      setError(null);
    } catch (err) {
      console.error('[useFetchData] Error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch data');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    fetch();
  }, dependencies);

  return { data, setData, loading, error, refresh: fetch };
};
