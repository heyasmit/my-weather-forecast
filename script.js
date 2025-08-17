// Weather QuickLook — No API key needed (Open‑Meteo).
// Beginner-friendly JavaScript with comments.
//
// Main features:
// - Search by city name (geocoding)
// - Use current location (geolocation)
// - 7-day forecast + current conditions
// - Celsius / Fahrenheit toggle
//
// Data docs: https://open-meteo.com/

const searchForm = document.getElementById('search-form');
const cityInput  = document.getElementById('city-input');
const currentEl  = document.getElementById('current');
const forecastEl = document.getElementById('forecast');
const unitToggle = document.getElementById('unit-toggle');
const geoBtn     = document.getElementById('geo-btn');

let lastData = null;     // Keep last fetched data for unit switching
let useFahrenheit = false;

// WMO weather code → text + emoji
const WEATHER_MAP = [
  { codes: [0], text: 'Clear sky', emoji: '☀️' },
  { codes: [1,2,3], text: 'Partly cloudy', emoji: '🌤️' },
  { codes: [45,48], text: 'Fog', emoji: '🌫️' },
  { codes: [51,53,55], text: 'Drizzle', emoji: '🌦️' },
  { codes: [56,57,66,67], text: 'Freezing rain', emoji: '🧊' },
  { codes: [61,63,65,80,81,82], text: 'Rain', emoji: '🌧️' },
  { codes: [71,73,75,77,85,86], text: 'Snow', emoji: '❄️' },
  { codes: [95,96,99], text: 'Thunderstorm', emoji: '⛈️' }
];

function codeToInfo(code) {
  for (const entry of WEATHER_MAP) {
    if (entry.codes.includes(code)) return entry;
  }
  return { text: 'Unknown', emoji: '❔' };
}

// Helpers
const CtoF = c => (c * 9/5) + 32;
const fmtTemp = c => useFahrenheit ? Math.round(CtoF(c)) + '°F' : Math.round(c) + '°C';

function dayName(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function nicePlaceName(place) {
  const parts = [place.name, place.admin1, place.country].filter(Boolean);
  // Avoid duplicates, keep things short
  const seen = new Set();
  return parts.filter(p => (p = String(p).trim()) && !seen.has(p) && seen.add(p)).join(', ');
}

// Fetch geocoding for a city name
async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error('City not found');
  return data.results[0];
}

// Reverse-geocode (coords → city)
async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return (data && data.results && data.results[0]) || null;
}

// Fetch weather forecast for given lat/lon
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum',
    current_weather: 'true',
    timezone: 'auto'
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  const data = await res.json();
  return data;
}

function render(data, placeLabel) {
  lastData = { data, placeLabel };

  // CURRENT
  const cw = data.current_weather;
  const info = codeToInfo(cw.weathercode);
  const now = new Date(cw.time);
  const subtitle = `${now.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;

  currentEl.innerHTML = `
    <div class="current-wrap">
      <div class="current-emoji">${info.emoji}</div>
      <div class="current-meta">
        <div class="current-title">${placeLabel}</div>
        <div class="current-subtitle">${info.text} • ${subtitle}</div>
      </div>
      <div class="current-temp">${fmtTemp(cw.temperature)}</div>
    </div>
  `;

  // FORECAST
  const d = data.daily;
  const n = d.time.length;
  const items = [];
  for (let i = 0; i < n; i++) {
    const code = d.weathercode[i];
    const min = d.temperature_2m_min[i];
    const max = d.temperature_2m_max[i];
    const precip = d.precipitation_sum[i];
    const info = codeToInfo(code);
    items.push(`
      <div class="forecast-day">
        <div class="day-name">${dayName(d.time[i])}</div>
        <div class="day-emoji">${info.emoji}</div>
        <div class="temp-range">${fmtTemp(min)} • ${fmtTemp(max)}</div>
        <div class="precip">${Math.round(precip)} mm</div>
      </div>
    `);
  }
  forecastEl.innerHTML = items.join('');
}

// Events
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = cityInput.value.trim();
  if (!q) return;
  try {
    currentEl.innerHTML = '<div class="placeholder">Loading…</div>';
    const place = await geocodeCity(q);
    const data = await fetchWeather(place.latitude, place.longitude);
    render(data, nicePlaceName(place));
  } catch (err) {
    currentEl.innerHTML = '<div class="placeholder">Could not find that city. Try another search.</div>';
    forecastEl.innerHTML = '';
  }
});

geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported in your browser.');
    return;
  }
  currentEl.innerHTML = '<div class="placeholder">Getting your location…</div>';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    try {
      const [place, data] = await Promise.all([
        reverseGeocode(latitude, longitude),
        fetchWeather(latitude, longitude)
      ]);
      const label = place ? nicePlaceName(place) : `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      render(data, label);
    } catch (err) {
      currentEl.innerHTML = '<div class="placeholder">Failed to get weather for your location.</div>';
      forecastEl.innerHTML = '';
    }
  }, () => {
    currentEl.innerHTML = '<div class="placeholder">Location access denied.</div>';
  });
});

unitToggle.addEventListener('change', () => {
  useFahrenheit = unitToggle.checked;
  if (lastData) {
    render(lastData.data, lastData.placeLabel);
  }
});
