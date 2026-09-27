// =========================================================
// WeatherGPT API Service
// =========================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";


// =========================================================
// GENERIC RESPONSE HANDLER
// =========================================================

async function handleResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(detail);
  }

  return data;
}


// =========================================================
// WEATHER
// =========================================================

export async function getWeather(
  latitude,
  longitude
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/weather?${params.toString()}`,
    {
      method: "GET",
    }
  );

  return handleResponse(response);
}


// =========================================================
// REVERSE LOCATION
// Latitude + Longitude -> Location Name
// =========================================================

export async function getLocationName(
  latitude,
  longitude
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/location?${params.toString()}`,
    {
      method: "GET",
    }
  );

  return handleResponse(response);
}


// =========================================================
// SEARCH LOCATION
// Location Name -> Coordinates
// =========================================================

export async function searchLocation(
  query
) {
  const cleanQuery =
    String(query || "").trim();

  if (!cleanQuery) {
    return {
      results: [],
    };
  }

  const params = new URLSearchParams({
    query: cleanQuery,
  });

  const response = await fetch(
    `${API_BASE_URL}/api/search-location?${params.toString()}`,
    {
      method: "GET",
    }
  );

  return handleResponse(response);
}


// =========================================================
// CHAT
// =========================================================

export async function sendChatMessage(
  message,
  weatherContext,
  chatHistory = []
) {
  const response = await fetch(
    `${API_BASE_URL}/api/chat`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        message,
        weather_context:
          weatherContext || {},
        chat_history:
          Array.isArray(chatHistory)
            ? chatHistory
            : [],
      }),
    }
  );

  return handleResponse(response);
}


// =========================================================
// VOICE -> TEXT
// BHASHINI
// =========================================================

export async function transcribeVoice(
  audioBlob,
  language = ""
) {
  if (!audioBlob) {
    throw new Error(
      "No audio recording was provided."
    );
  }

  const formData =
    new FormData();

  formData.append(
    "audio",
    audioBlob,
    "recording.webm"
  );

  formData.append(
    "language",
    language
  );

  const response = await fetch(
    `${API_BASE_URL}/api/voice/transcribe`,
    {
      method: "POST",
      body: formData,
    }
  );

  return handleResponse(response);
}


// =========================================================
// TEXT -> VOICE
// BHASHINI
// =========================================================

export async function speakVoice(
  text,
  language
) {
  const cleanText =
    String(text || "").trim();

  if (!cleanText) {
    throw new Error(
      "Text is required for voice synthesis."
    );
  }

  if (!language) {
    throw new Error(
      "Language is required for voice synthesis."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/voice/speak`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        text: cleanText,
        language,
      }),
    }
  );

  if (!response.ok) {
    let errorMessage =
      `Voice synthesis failed with status ${response.status}`;

    try {
      const data =
        await response.json();

      errorMessage =
        data?.detail ||
        data?.message ||
        errorMessage;
    } catch {
      // Keep default error.
    }

    throw new Error(
      errorMessage
    );
  }

  return response.blob();
}


// =========================================================
// LIVE WIND MAP
// =========================================================

export async function getWindMap(
  latitude = null,
  longitude = null
) {
  const params =
    new URLSearchParams();

  if (
    latitude !== null &&
    latitude !== undefined
  ) {
    params.set(
      "latitude",
      String(latitude)
    );
  }

  if (
    longitude !== null &&
    longitude !== undefined
  ) {
    params.set(
      "longitude",
      String(longitude)
    );
  }

  const query =
    params.toString();

  const url =
    `${API_BASE_URL}/api/wind-map` +
    (query ? `?${query}` : "");

  const response = await fetch(
    url,
    {
      method: "GET",
    }
  );

  return handleResponse(response);
}


// =========================================================
// ROUTE
// Origin + Destination -> Road Route
// =========================================================

export async function getRoute(
  origin,
  destination,
  alternatives = true
) {
  const cleanOrigin =
    String(origin || "").trim();

  const cleanDestination =
    String(destination || "").trim();

  if (!cleanOrigin) {
    throw new Error(
      "Origin location is required."
    );
  }

  if (!cleanDestination) {
    throw new Error(
      "Destination location is required."
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/route`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        origin: cleanOrigin,

        destination:
          cleanDestination,

        alternatives:
          Boolean(alternatives),
      }),
    }
  );

  return handleResponse(response);
}


// =========================================================
// TRAVEL ADVICE
// Existing WeatherGPT travel analysis
// =========================================================

export async function getTravelAdvice(
  origin,
  destination,
  date = "today"
) {
  const response = await fetch(
    `${API_BASE_URL}/api/travel-advice`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        origin:
          String(origin || "").trim(),

        destination:
          String(destination || "").trim(),

        date,
      }),
    }
  );

  return handleResponse(response);
}


// =========================================================
// HEALTH CHECK
// =========================================================

export async function checkHealth() {
  const response = await fetch(
    `${API_BASE_URL}/api/health`,
    {
      method: "GET",
    }
  );

  return handleResponse(response);
}


// =========================================================
// DEFAULT EXPORT
// =========================================================

export default {
  getWeather,
  getLocationName,
  searchLocation,
  sendChatMessage,
  transcribeVoice,
  speakVoice,
  getWindMap,
  getRoute,
  getTravelAdvice,
  checkHealth,
};