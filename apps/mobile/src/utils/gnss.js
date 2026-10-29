/**
 * Navitel-style GNSS utilities and coordinate selection hierarchy.
 * Rule R-02 compliant: Zero em dashes in code, strings, and comments.
 */

/**
 * Validates if coordinates contain numeric latitude and longitude.
 * @param {object} coords
 * @returns {boolean}
 */
export function isValidCoords(coords) {
  if (!coords || typeof coords !== 'object') return false;
  const c = coords.coords || coords;
  return (
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    !isNaN(c.latitude) &&
    !isNaN(c.longitude)
  );
}

/**
 * Normalizes coordinate structure from various location shapes.
 * @param {object} item
 * @returns {object|null}
 */
export function normalizeCoords(item) {
  if (!item || typeof item !== 'object') return null;
  const c = item.coords || item;
  if (
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    !isNaN(c.latitude) &&
    !isNaN(c.longitude)
  ) {
    const accuracy = typeof c.accuracy === 'number' && !isNaN(c.accuracy) ? c.accuracy : 5;
    const timestamp = typeof c.timestamp === 'number' ? c.timestamp : (typeof item.timestamp === 'number' ? item.timestamp : undefined);
    return {
      latitude: c.latitude,
      longitude: c.longitude,
      accuracy,
      ...(timestamp !== undefined ? { timestamp } : {})
    };
  }
  return null;
}

/**
 * Formats GNSS accuracy value into rounded integer meters.
 * @param {number|null|undefined} accuracy
 * @returns {number}
 */
export function formatAccuracy(accuracy) {
  if (typeof accuracy === 'number' && !isNaN(accuracy)) {
    return Math.round(accuracy);
  }
  return 5;
}

/**
 * Formats real-time GNSS satellite tracking status banner text.
 * @param {object} options
 * @param {boolean} options.isRooted
 * @param {boolean} options.isMocked
 * @param {object|null} options.location
 * @returns {string}
 */
export function formatGnssStatus({ isRooted, isMocked, location }) {
  if (isRooted) {
    return 'Peringatan: Integritas sistem perangkat tidak memenuhi standar.';
  }
  if (isMocked) {
    return 'Peringatan: Lokasi tiruan (Mock Location) terdeteksi.';
  }
  if (location && isValidCoords(location)) {
    const coords = location.coords || location;
    const acc = formatAccuracy(coords.accuracy);
    return `GPS Terkunci: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} (Akurasi ±${acc} m)`;
  }
  return 'Mencari sinyal GPS...';
}

/**
 * Fast-path coordinate selection hierarchy:
 * 1. Priority 1: photoCoords (locked at watermark capture time)
 * 2. Priority 2: currentLocation (maintained continuously by GNSS watcher)
 * 3. Priority 3: cachedLocation (valid within maxAgeMs, default 5 min)
 * 4. Fallback: null (signals need for fast fetch or user prompt)
 *
 * @param {object} params
 * @param {object|null} [params.photoCoords]
 * @param {object|null} [params.currentLocation]
 * @param {object|null} [params.cachedLocation]
 * @param {number} [params.maxAgeMs=300000]
 * @returns {object|null}
 */
export function selectSubmissionCoords({ photoCoords, currentLocation, cachedLocation, maxAgeMs = 300000 } = {}) {
  // Priority 1: Photo coords from watermark camera capture
  const photo = normalizeCoords(photoCoords);
  if (photo) {
    return {
      latitude: photo.latitude,
      longitude: photo.longitude,
      accuracy: photo.accuracy,
      source: 'photo',
      ...(photo.timestamp ? { timestamp: photo.timestamp } : {})
    };
  }

  // Priority 2: Current location from continuous GNSS watcher
  const current = normalizeCoords(currentLocation);
  if (current) {
    return {
      latitude: current.latitude,
      longitude: current.longitude,
      accuracy: current.accuracy,
      source: 'watcher',
      ...(current.timestamp ? { timestamp: current.timestamp } : {})
    };
  }

  // Priority 3: Cached location from AsyncStorage if within max age
  const cached = normalizeCoords(cachedLocation);
  if (cached) {
    if (!cached.timestamp || (Date.now() - cached.timestamp <= maxAgeMs)) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        accuracy: cached.accuracy,
        source: 'cache',
        ...(cached.timestamp ? { timestamp: cached.timestamp } : {})
      };
    }
  }

  // Fallback: No valid coordinates found
  return null;
}
