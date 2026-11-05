/**
 * RKB (Rencana Kerja Bulanan) and KPI Mobile API Client
 * Provides API queries to Google Apps Script endpoints with local cache resilience.
 *
 * Rule R-02 compliant: Zero em dashes in code, strings, and comments.
 */

import axios from 'axios';
import { API_URL } from './api.js';

let defaultStorage = null;
try {
  if (typeof require === 'function') {
    defaultStorage = require('@react-native-async-storage/async-storage');
    if (defaultStorage && defaultStorage.default) {
      defaultStorage = defaultStorage.default;
    }
  }
} catch (_) {
  // Headless test fallback
}

const memoryStore = new Map();
const fallbackStorageAdapter = {
  getItem: async (key) => {
    if (defaultStorage && typeof defaultStorage.getItem === 'function') {
      return defaultStorage.getItem(key);
    }
    return memoryStore.get(key) || null;
  },
  setItem: async (key, val) => {
    if (defaultStorage && typeof defaultStorage.setItem === 'function') {
      return defaultStorage.setItem(key, val);
    }
    memoryStore.set(key, String(val));
  },
  removeItem: async (key) => {
    if (defaultStorage && typeof defaultStorage.removeItem === 'function') {
      return defaultStorage.removeItem(key);
    }
    memoryStore.delete(key);
  }
};

let currentStorageAdapter = fallbackStorageAdapter;
let currentHttpAdapter = axios;

export function setRkbStorageAdapter(adapter) {
  if (adapter) currentStorageAdapter = adapter;
}

export function getRkbStorageAdapter() {
  return currentStorageAdapter;
}

export function setRkbHttpAdapter(adapter) {
  if (adapter) currentHttpAdapter = adapter;
}

export function getRkbHttpAdapter() {
  return currentHttpAdapter;
}

export function getRkbCacheKey({ nama, bulan, tahun }) {
  const normNama = String(nama || '').toLowerCase().trim();
  const normBulan = String(bulan || 'all').toLowerCase().trim();
  const normTahun = String(tahun || 'all').toLowerCase().trim();
  return `@rkb_cache_${normNama}_${normBulan}_${normTahun}`;
}

export async function fetchRkbDataMobile({
  nama,
  divisi,
  bulan,
  tahun,
  timeout = 12000,
  forceRefresh = false
}) {
  const cacheKey = getRkbCacheKey({ nama, bulan, tahun });
  const storage = currentStorageAdapter;
  const http = currentHttpAdapter;

  const payload = {
    action: 'getRkbKaryawan',
    nama: nama || '',
    divisi: divisi || '',
    bulan: bulan || '',
    tahun: tahun || new Date().getFullYear()
  };

  try {
    const res = await http.post(API_URL, payload, { timeout });
    const resData = res && res.data ? res.data : null;

    if (resData && (resData.success || resData.found !== undefined)) {
      const responseToSave = {
        ...resData,
        fromCache: false,
        cachedAt: Date.now()
      };
      try {
        await storage.setItem(cacheKey, JSON.stringify(responseToSave));
      } catch (storageErr) {
        // Non-fatal if storage write fails
      }
      return responseToSave;
    }
    throw new Error(resData?.message || 'Gagal memuat data RKB dari server.');
  } catch (networkErr) {
    // Attempt fallback from storage
    try {
      const cached = await storage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...parsed,
          fromCache: true,
          isOffline: true
        };
      }
    } catch (_) {}

    // No cache available, propagate original network error
    throw networkErr;
  }
}

export async function fetchAllRkbSummaryMobile({ bulan, tahun, timeout = 15000 }) {
  const http = currentHttpAdapter;
  const payload = {
    action: 'getAllRkbSummary',
    bulan: bulan || '',
    tahun: tahun || new Date().getFullYear()
  };

  const res = await http.post(API_URL, payload, { timeout });
  return res && res.data ? res.data : { success: false, summary: [] };
}
