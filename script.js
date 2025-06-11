const apiKey = 'YOUR_API_KEY_HERE'; // Replace with your OpenWeatherMap API key
let unit = localStorage.getItem('unit') || 'metric';
let use12h = localStorage.getItem('timeFormat') === '12';

const locationInput = document.getElementById('location-input');
const suggestions = document.getElementById('suggestions');
const locateBtn = document.getElementById('locate-btn');
const unitToggle = document.getElementById('unit-toggle');
const timeToggle = document.getElementById('time-toggle');
const currentSection = document.getElementById('current');
const forecastSection = document.getElementById('forecast');
const alertsSection = document.getElementById('alerts');

unitToggle.checked = unit === 'imperial';
timeToggle.checked = use12h;

unitToggle.addEventListener('change', () => {
    unit = unitToggle.checked ? 'imperial' : 'metric';
    localStorage.setItem('unit', unit);
    if (currentCoords) {
        fetchWeather(currentCoords.lat, currentCoords.lon);
    }
});

timeToggle.addEventListener('change', () => {
    use12h = timeToggle.checked;
    localStorage.setItem('timeFormat', use12h ? '12' : '24');
    if (currentCoords) {
        fetchWeather(currentCoords.lat, currentCoords.lon);
    }
});

locationInput.addEventListener('input', async () => {
    const q = locationInput.value.trim();
    if (!q) return;
    const res = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${apiKey}`);
    const data = await res.json();
    suggestions.innerHTML = data.map(loc => `<option value="${loc.name}, ${loc.country}" data-lat="${loc.lat}" data-lon="${loc.lon}"></option>`).join('');
});

locationInput.addEventListener('change', () => {
    const option = Array.from(suggestions.options).find(o => o.value === locationInput.value);
    if (option) {
        const lat = option.getAttribute('data-lat');
        const lon = option.getAttribute('data-lon');
        currentCoords = { lat, lon };
        storeHistory(locationInput.value, lat, lon);
        fetchWeather(lat, lon);
    }
});

locateBtn.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        currentCoords = { lat: latitude, lon: longitude };
        fetchWeather(latitude, longitude);
    });
});

let currentCoords = null;

function storeHistory(name, lat, lon) {
    const history = JSON.parse(localStorage.getItem('history') || '[]');
    history.unshift({ name, lat, lon });
    localStorage.setItem('history', JSON.stringify(history.slice(0,10)));
}

function formatTime(ts) {
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: use12h });
}

function updateBackground(icon, main) {
    const body = document.body;
    body.className = '';
    const time = icon.includes('d') ? 'day' : 'night';
    const condition = main.toLowerCase();
    body.classList.add(time);
    if (condition.includes('cloud')) body.classList.add('clouds');
    else if (condition.includes('rain')) body.classList.add('rain');
    else body.classList.add('clear');
}

function renderCurrent(data) {
    currentSection.innerHTML = `
        <div class="card">
            <h2>${data.name}</h2>
            <p>${formatTime(data.current.dt)}</p>
            <img src="https://openweathermap.org/img/wn/${data.current.weather[0].icon}@2x.png" alt="">
            <h3>${Math.round(data.current.temp)}°${unit === 'metric' ? 'C' : 'F'}</h3>
            <p>${data.current.weather[0].description}</p>
            <p>Wind: ${data.current.wind_speed} ${unit === 'metric' ? 'm/s' : 'mph'} (${data.current.wind_deg}°)</p>
            <p>Humidity: ${data.current.humidity}%</p>
            <p>Pressure: ${data.current.pressure} hPa</p>
            <p>UV Index: ${data.current.uvi}</p>
            ${data.current.air_quality ? `<p>Air Quality: ${data.current.air_quality}</p>` : ''}
            <p>Sunrise: ${formatTime(data.current.sunrise)}</p>
            <p>Sunset: ${formatTime(data.current.sunset)}</p>
        </div>
    `;
}

function renderForecast(data) {
    const days = data.daily.slice(1,6);
    forecastSection.innerHTML = days.map(day => {
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString([], { weekday: 'long' });
        const hours = data.hourly.filter(h => {
            const hd = new Date(h.dt * 1000);
            return hd.getDate() === date.getDate();
        });
        const hourlyHtml = hours.map(h => `<div>
            <span>${formatTime(h.dt)}</span>
            <img src="https://openweathermap.org/img/wn/${h.weather[0].icon}.png" alt="">
            <span>${Math.round(h.temp)}°</span>
        </div>`).join('');
        return `<details class="card"><summary>${dayName} - ${Math.round(day.temp.max)}° / ${Math.round(day.temp.min)}°</summary><div class="hourly">${hourlyHtml}</div></details>`;
    }).join('');
}

function renderAlerts(alerts) {
    if (!alerts) { alertsSection.textContent = ''; return; }
    alertsSection.innerHTML = alerts.map(a => `<div class="card alert"><strong>${a.event}</strong>: ${a.description}</div>`).join('');
}

async function fetchWeather(lat, lon) {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&units=${unit}&appid=${apiKey}`);
    const data = await res.json();
    const nameRes = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`);
    const nameData = await nameRes.json();
    data.name = nameData[0]?.name || '';
    const airRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
    const airData = await airRes.json();
    data.current.air_quality = airData.list?.[0]?.main?.aqi;
    updateBackground(data.current.weather[0].icon, data.current.weather[0].main);
    renderCurrent(data);
    renderForecast(data);
    renderAlerts(data.alerts);
}

// Load last history or geolocate
const history = JSON.parse(localStorage.getItem('history') || '[]');
if (history.length) {
    currentCoords = { lat: history[0].lat, lon: history[0].lon };
    fetchWeather(currentCoords.lat, currentCoords.lon);
} else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
        currentCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        fetchWeather(currentCoords.lat, currentCoords.lon);
    });
}
