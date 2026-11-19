// In-memory geocoding cache to prevent redundant network requests
const geocodeCache: Record<string, string> = {};

export async function getReverseGeocodedAddress(
  lat?: number,
  lon?: number,
  existingAddress?: string
): Promise<string> {
  if (existingAddress && existingAddress.trim().length > 0) {
    return existingAddress.trim();
  }

  if (lat === undefined || lon === undefined || (lat === 0 && lon === 0)) {
    return 'Location not available';
  }

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (geocodeCache[key]) {
    return geocodeCache[key];
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GetTrackGTS/1.0',
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        geocodeCache[key] = data.display_name;
        return data.display_name;
      }
    }
  } catch (e) {
    // Fall back to coordinates on error
  }

  const fallback = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  geocodeCache[key] = fallback;
  return fallback;
}

