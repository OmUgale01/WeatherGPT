export function getWeatherDescription(code) {
  const weatherCodes = {
    0: {
      label: "Clear sky",
      icon: "☀️",
    },

    1: {
      label: "Mainly clear",
      icon: "🌤️",
    },

    2: {
      label: "Partly cloudy",
      icon: "⛅",
    },

    3: {
      label: "Overcast",
      icon: "☁️",
    },

    45: {
      label: "Fog",
      icon: "🌫️",
    },

    48: {
      label: "Depositing rime fog",
      icon: "🌫️",
    },

    51: {
      label: "Light drizzle",
      icon: "🌦️",
    },

    53: {
      label: "Moderate drizzle",
      icon: "🌦️",
    },

    55: {
      label: "Dense drizzle",
      icon: "🌧️",
    },

    61: {
      label: "Slight rain",
      icon: "🌦️",
    },

    63: {
      label: "Moderate rain",
      icon: "🌧️",
    },

    65: {
      label: "Heavy rain",
      icon: "🌧️",
    },

    71: {
      label: "Slight snow",
      icon: "🌨️",
    },

    73: {
      label: "Moderate snow",
      icon: "🌨️",
    },

    75: {
      label: "Heavy snow",
      icon: "❄️",
    },

    80: {
      label: "Rain showers",
      icon: "🌦️",
    },

    81: {
      label: "Moderate rain showers",
      icon: "🌧️",
    },

    82: {
      label: "Heavy rain showers",
      icon: "⛈️",
    },

    95: {
      label: "Thunderstorm",
      icon: "⛈️",
    },

    96: {
      label: "Thunderstorm with hail",
      icon: "⛈️",
    },

    99: {
      label: "Severe thunderstorm with hail",
      icon: "⛈️",
    },
  };

  return (
    weatherCodes[code] || {
      label: "Unknown",
      icon: "🌡️",
    }
  );
}