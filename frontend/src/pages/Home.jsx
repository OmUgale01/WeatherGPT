import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";


import {
  Search,
  MapPin,
  RefreshCw,
  Send,
  Loader2,
  Mic,
  MicOff,
  AlertTriangle,
  Droplets,
  Wind,
  CloudRain,
  MoreHorizontal,
  UserRound,
  LogOut,
} from "lucide-react";

import {
  getWeather,
  getLocationName,
  searchLocation,
  sendChatMessage,
  transcribeVoice,
} from "../services/api";

import { supabase } from "../lib/supabaseClient";

import { useLocation } from "../hooks/useLocation";
import { getWeatherDescription } from "../utils/weather";

import WindMap from "../components/WindMap";
import RouteSafetyMap from "../components/RouteSafetyMap";

import "./HomeQuickActions.css";
import "./ProfileMenu.css";


function Home() {

  /* =====================================================
     PROFILE
     ===================================================== */

  const [profileOpen, setProfileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);


  /* =====================================================
     LOCATION
     ===================================================== */

  const {
    location,
    error: locationError,
    loading: locationLoading,
    requestLocation,
  } = useLocation();


  /* =====================================================
     WEATHER
     ===================================================== */

  const [locationName, setLocationName] = useState("");
  const [locationDetails, setLocationDetails] = useState(null);

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");


  /* =====================================================
     SEARCH
     ===================================================== */

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);


  /* =====================================================
     CHAT
     ===================================================== */

  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");


  /* =====================================================
     VOICE
     ===================================================== */

  const [isRecording, setIsRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);


  /* =====================================================
     MORE MENU
     ===================================================== */

  const [moreOpen, setMoreOpen] = useState(false);


  /* =====================================================
     LIVE WIND MAP
     ===================================================== */

  const [windMapOpen, setWindMapOpen] = useState(false);


  /* =====================================================
     TRAVEL SAFETY
     ===================================================== */

  const [routeSafetyOpen, setRouteSafetyOpen] = useState(false);


  /* =====================================================
     REFS
     ===================================================== */

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const moreMenuRef = useRef(null);
  const profileMenuRef = useRef(null);


  /* =====================================================
     LOAD LOGGED-IN USER
     ===================================================== */

  useEffect(() => {

    const loadUser = async () => {

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error(
          "Unable to get logged-in user:",
          error
        );
        return;
      }

      setUserEmail(user?.email || "");
    };

    loadUser();

  }, []);


  /* =====================================================
     LOGOUT
     ===================================================== */

  const handleLogout = async () => {

    setLoggingOut(true);

    try {

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

    } catch (error) {

      console.error(
        "Logout failed:",
        error
      );

      setLoggingOut(false);
    }
  };


  /* =====================================================
     REQUEST LOCATION
     ===================================================== */

  useEffect(() => {
    requestLocation();
  }, []);


  /* =====================================================
     CLOSE MENUS WHEN CLICKING OUTSIDE
     ===================================================== */

  useEffect(() => {

    const handleOutsideClick = (event) => {

      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(
          event.target
        )
      ) {
        setMoreOpen(false);
      }

      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(
          event.target
        )
      ) {
        setProfileOpen(false);
      }

    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {

      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

    };

  }, []);


  /* =====================================================
     SEARCH
     ===================================================== */

  useEffect(() => {

    const query =
      searchQuery.trim();

    if (!query) {

      setSearchResults([]);
      setSearchLoading(false);

      return;
    }

    const timer =
      setTimeout(async () => {

        setSearchLoading(true);

        try {

          const data =
            await searchLocation(query);

          const results =
            Array.isArray(data)
              ? data
              : Array.isArray(
                  data?.results
                )
              ? data.results
              : [];

          setSearchResults(results);

        } catch (error) {

          console.error(
            "Search error:",
            error
          );

          setSearchResults([]);

        } finally {

          setSearchLoading(false);

        }

      }, 400);

    return () =>
      clearTimeout(timer);

  }, [searchQuery]);


  /* =====================================================
     LOAD WEATHER
     ===================================================== */

  useEffect(() => {

    const activeLocation =
      selectedLocation || location;

    if (!activeLocation) return;

    const loadWeather =
      async () => {

        setWeatherLoading(true);
        setWeatherError("");

        try {

          const data =
            await getWeather(
              activeLocation.latitude,
              activeLocation.longitude
            );

          setWeather(data);

          if (selectedLocation) {

            setLocationName(
              selectedLocation.name
            );

            setLocationDetails({
              city:
                selectedLocation.name,
              district: "",
              state:
                selectedLocation.state ||
                "",
              country:
                selectedLocation.country ||
                "",
            });

          } else {

            const details =
              await getLocationName(
                activeLocation.latitude,
                activeLocation.longitude
              );

            setLocationDetails(
              details
            );

            setLocationName(
              details.city ||
                details.district ||
                details.state ||
                "Your Location"
            );
          }

          setChatMessages([]);
          setChatMessage("");
          setChatError("");

        } catch (error) {

          console.error(
            "Weather error:",
            error
          );

          setWeatherError(
            error.message ||
              "Unable to load weather information."
          );

        } finally {

          setWeatherLoading(false);

        }
      };

    loadWeather();

  }, [
    location,
    selectedLocation,
  ]);


  /* =====================================================
     SEARCH SUBMIT
     ===================================================== */

  const handleSearchSubmit =
    async (event) => {

      event.preventDefault();

      const query =
        searchQuery.trim();

      if (!query) return;

      if (searchResults.length > 0) {

        handleSelectLocation(
          searchResults[0]
        );

        return;
      }

      setSearchLoading(true);

      try {

        const data =
          await searchLocation(query);

        const results =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.results
              )
            ? data.results
            : [];

        if (results.length > 0) {

          handleSelectLocation(
            results[0]
          );

        } else {

          setSearchResults([]);

          setWeatherError(
            "Location not found."
          );

        }

      } catch (error) {

        console.error(
          "Direct search error:",
          error
        );

        setSearchResults([]);

        setWeatherError(
          "Unable to search for this location."
        );

      } finally {

        setSearchLoading(false);

      }
    };


  /* =====================================================
     SELECT LOCATION
     ===================================================== */

  const handleSelectLocation =
    (result) => {

      if (!result) return;

      const newLocation = {

        name: result.name,

        latitude:
          Number(result.latitude),

        longitude:
          Number(result.longitude),

        country:
          result.country || "",

        state:
          result.state || "",
      };

      setSelectedLocation(
        newLocation
      );

      setSearchQuery("");
      setSearchResults([]);

      setChatMessages([]);
      setChatMessage("");
      setChatError("");
      setWeatherError("");
    };


  /* =====================================================
     USE CURRENT LOCATION
     ===================================================== */

  const handleUseCurrentLocation =
    () => {

      setSelectedLocation(null);

      setSearchQuery("");
      setSearchResults([]);

      setWeather(null);
      setWeatherError("");

      setChatMessages([]);
      setChatMessage("");
      setChatError("");

      requestLocation();
    };


  /* =====================================================
     VOICE INPUT
     ===================================================== */

  const handleVoiceInput =
    async () => {

      if (isRecording) {

        mediaRecorderRef.current?.stop();

        return;
      }

      if (
        !navigator.mediaDevices?.getUserMedia
      ) {

        setChatError(
          "Voice recording is not supported by this browser."
        );

        return;
      }

      try {

        setChatError("");

        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
          });

        let mimeType = "";

        if (
          MediaRecorder.isTypeSupported(
            "audio/webm;codecs=opus"
          )
        ) {

          mimeType =
            "audio/webm;codecs=opus";

        } else if (
          MediaRecorder.isTypeSupported(
            "audio/webm"
          )
        ) {

          mimeType =
            "audio/webm";
        }

        const mediaRecorder =
          mimeType
            ? new MediaRecorder(
                stream,
                { mimeType }
              )
            : new MediaRecorder(
                stream
              );

        mediaRecorderRef.current =
          mediaRecorder;

        audioChunksRef.current = [];

        mediaRecorder.ondataavailable =
          (event) => {

            if (event.data.size > 0) {

              audioChunksRef.current.push(
                event.data
              );
            }
          };

        mediaRecorder.onstop =
          async () => {

            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

            setIsRecording(false);
            setVoiceLoading(true);

            try {

              const audioBlob =
                new Blob(
                  audioChunksRef.current,
                  {
                    type:
                      mediaRecorder.mimeType ||
                      "audio/webm",
                  }
                );

              const result =
                await transcribeVoice(
                  audioBlob
                );

              const transcript =
                result?.text ||
                result?.transcript ||
                result?.response ||
                "";

              if (
                !transcript.trim()
              ) {

                throw new Error(
                  "I couldn't understand the voice input."
                );
              }

              setChatMessage(
                transcript.trim()
              );

            } catch (error) {

              console.error(
                "Voice transcription error:",
                error
              );

              setChatError(
                error.message ||
                  "Unable to understand your voice."
              );

            } finally {

              setVoiceLoading(false);

            }
          };

        mediaRecorder.start();

        setIsRecording(true);

      } catch (error) {

        console.error(
          "Microphone error:",
          error
        );

        setChatError(
          "Microphone permission was denied or unavailable."
        );
      }
    };


  /* =====================================================
     SEND CHAT
     ===================================================== */

  const handleSendMessage =
    async (event) => {

      event.preventDefault();

      const message =
        chatMessage.trim();

      if (
        !message ||
        !weather ||
        chatLoading ||
        isRecording ||
        voiceLoading
      ) {
        return;
      }

      setChatLoading(true);
      setChatError("");

      try {

        const history =
          chatMessages.map(
            (item) => ({
              role: item.role,
              content: item.content,
            })
          );

        const activeLocation =
          selectedLocation || location;

        const weatherContext = {

          location:
            locationName ||
            "Current location",

          coordinates: {

            latitude:
              activeLocation?.latitude ??
              null,

            longitude:
              activeLocation?.longitude ??
              null,
          },

          current: {

            temperature_c:
              weather?.current
                ?.temperature_2m ??
              null,

            feels_like_c:
              weather?.current
                ?.apparent_temperature ??
              null,

            humidity_percent:
              weather?.current
                ?.relative_humidity_2m ??
              null,

            wind_speed_kmh:
              weather?.current
                ?.wind_speed_10m ??
              null,

            precipitation_mm:
              weather?.current
                ?.precipitation ??
              null,

            weather_code:
              weather?.current
                ?.weather_code ??
              null,

            weather_condition:
              weatherInfo?.label ||
              "Unknown",
          },

          today: {

            date:
              weather?.daily
                ?.time?.[0] ??
              null,

            rain_probability_percent:
              weather?.daily
                ?.precipitation_probability_max?.[0] ??
              null,

            temperature_max_c:
              weather?.daily
                ?.temperature_2m_max?.[0] ??
              null,

            temperature_min_c:
              weather?.daily
                ?.temperature_2m_min?.[0] ??
              null,

            weather_code:
              weather?.daily
                ?.weather_code?.[0] ??
              null,
          },

          forecast: {

            dates:
              weather?.daily?.time ||
              [],

            max_temperature_c:
              weather?.daily
                ?.temperature_2m_max ||
              [],

            min_temperature_c:
              weather?.daily
                ?.temperature_2m_min ||
              [],

            rain_probability_percent:
              weather?.daily
                ?.precipitation_probability_max ||
              [],

            weather_codes:
              weather?.daily
                ?.weather_code ||
              [],
          },

          alerts:
            weather?.alerts || {
              has_alerts: false,
              severity: "low",
              alerts: [],
            },

          imd_alerts:
            weather?.imd_alerts || {
              available: false,
              official: true,
              source: "IMD",
              alerts: [],
            },
        };

        console.log(
          "WeatherGPT weather context:",
          weatherContext
        );

        const response =
          await sendChatMessage(
            message,
            weatherContext,
            history
          );

        const answer =
          response?.response ||
          response?.message ||
          response?.answer ||
          "I couldn't generate a response.";

        setChatMessages(
          (previous) => [
            ...previous,

            {
              role: "user",
              content: message,
            },

            {
              role: "assistant",
              content: answer,
            },
          ]
        );

        setChatMessage("");

      } catch (error) {

        console.error(
          "Chat error:",
          error
        );

        setChatError(
          error.message ||
            "Unable to get AI response."
        );

      } finally {

        setChatLoading(false);

      }
    };


  /* =====================================================
     MORE MENU ACTIONS
     ===================================================== */

  const scrollToSection =
    (selector) => {

      const section =
        document.querySelector(
          selector
        );

      if (section) {

        section.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    };


  /* =====================================================
     OPEN LIVE WIND MAP
     ===================================================== */

  const openWindMap = () => {

    setMoreOpen(false);
    setWindMapOpen(true);
  };


  /* =====================================================
     TRAVEL SAFETY
     ===================================================== */

  const openTravelSafety = () => {

    setMoreOpen(false);
    setRouteSafetyOpen(true);
  };


  /* =====================================================
     CLIMATE INFORMATION
     ===================================================== */

  const openClimateInformation =
    () => {

      setChatMessage(
        "Tell me about the climate of this location."
      );

      scrollToSection(
        ".ai-section"
      );

      setMoreOpen(false);
    };


  /* =====================================================
     VOICE LANGUAGES
     ===================================================== */

  const openVoiceLanguages =
    () => {

      setChatMessage(
        "What languages and voice features are available?"
      );

      scrollToSection(
        ".ai-section"
      );

      setMoreOpen(false);
    };


  /* =====================================================
     WEATHER DATA
     ===================================================== */

  const current =
    weather?.current;

  const daily =
    weather?.daily;


  const weatherInfo =
    useMemo(() => {

      if (!current) {

        return {
          label: "Loading",
          icon: "🌤️",
        };
      }

      return getWeatherDescription(
        current.weather_code
      );

    }, [current]);


  const alertData =
    weather?.alerts;


  const hasAlerts =
    alertData?.has_alerts === true &&
    Array.isArray(
      alertData?.alerts
    ) &&
    alertData.alerts.length > 0;


  /* =====================================================
     LOCATION LOADING SCREEN
     ===================================================== */

  if (
    locationLoading &&
    !location &&
    !selectedLocation
  ) {

    return (

      <main className="location-screen">

        <div className="location-card">

          <Loader2
            className="spin"
            size={42}
          />

          <h1>
            WeatherGPT
          </h1>

          <p>
            Getting your location to provide
            personalized weather information...
          </p>

        </div>

      </main>
    );
  }


  /* =====================================================
     LOCATION ERROR
     ===================================================== */

  if (
    locationError &&
    !location &&
    !selectedLocation
  ) {

    return (

      <main className="location-screen">

        <div className="location-card">

          <MapPin size={42} />

          <h1>
            WeatherGPT
          </h1>

          <p>
            {locationError}
          </p>

          <button
            className="location-button"
            onClick={
              requestLocation
            }
          >
            <RefreshCw size={18} />
            Try Again
          </button>

          <div className="location-search">

            <form
              className="search-form"
              onSubmit={
                handleSearchSubmit
              }
            >

              <Search size={20} />

              <input
                type="text"
                value={searchQuery}
                onChange={
                  (event) =>
                    setSearchQuery(
                      event.target.value
                    )
                }
                placeholder="Search for a city..."
                autoComplete="off"
              />

              <button
                type="submit"
                disabled={
                  searchLoading ||
                  !searchQuery.trim()
                }
              >
                {searchLoading
                  ? "Searching..."
                  : "Search"}
              </button>

            </form>

            {searchResults.length > 0 && (

              <div className="search-results">

                {searchResults.map(
                  (
                    result,
                    index
                  ) => (

                    <button
                      type="button"
                      className="search-result"
                      key={`${result.name}-${result.latitude}-${index}`}
                      onClick={() =>
                        handleSelectLocation(
                          result
                        )
                      }
                    >

                      <MapPin size={18} />

                      <div>

                        <strong>
                          {result.name}
                        </strong>

                        <span>
                          {[
                            result.state,
                            result.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>

                      </div>

                    </button>

                  )
                )}

              </div>
            )}

          </div>

        </div>

      </main>
    );
  }


  /* =====================================================
     MAIN PAGE
     ===================================================== */

  return (

    <>

      {/* LIVE WIND MAP */}

      {windMapOpen && (

        <WindMap
          location={
            selectedLocation ||
            location
          }
          locationName={
            locationName
          }
          onClose={() =>
            setWindMapOpen(false)
          }
        />

      )}


      {/* TRAVEL SAFETY ROUTE MAP */}

      {routeSafetyOpen && (

        <RouteSafetyMap
          initialOrigin={
            locationName || ""
          }
          onClose={() =>
            setRouteSafetyOpen(false)
          }
        />

      )}


      <div className="app">


        {/* =================================================
            NAVBAR
            ================================================= */}

        <header className="header">

          <div className="header-inner">


            {/* BRAND */}

            <div className="brand">

              <div className="brand-icon">
                🌦️
              </div>

              <div>

                <h1>
                  WeatherGPT
                </h1>

                <span>
                  AI Weather Intelligence
                </span>

              </div>

            </div>


            {/* HEADER ACTIONS */}

            <div className="header-actions">


              {/* MY LOCATION */}

              <button
                className="current-location-button"
                onClick={
                  handleUseCurrentLocation
                }
                title="Use current location"
              >

                <MapPin size={18} />

                <span>
                  My Location
                </span>

              </button>


              {/* PROFILE */}

              <div
                className="profile-menu"
                ref={profileMenuRef}
              >

                <button
                  type="button"
                  className={`profile-button ${
                    profileOpen
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setProfileOpen(
                      (previous) =>
                        !previous
                    )
                  }
                  title="Profile"
                  aria-label="Open profile"
                  aria-expanded={
                    profileOpen
                  }
                >

                  <UserRound
                    size={20}
                  />

                </button>


                {/* PROFILE DROPDOWN */}

                {profileOpen && (

                  <div className="profile-dropdown">


                    {/* PROFILE HEADER */}

                    <div className="profile-header">

                      <div className="profile-avatar">

                        <UserRound
                          size={22}
                        />

                      </div>

                      <div className="profile-info">

                        <span className="profile-label">
                          Signed in as
                        </span>

                        <strong>
                          {userEmail ||
                            "WeatherGPT user"}
                        </strong>

                      </div>

                    </div>


                    {/* DIVIDER */}

                    <div className="profile-divider" />


                    {/* LOGOUT */}

                    <button
                      type="button"
                      className="profile-logout"
                      onClick={
                        handleLogout
                      }
                      disabled={
                        loggingOut
                      }
                    >

                      {loggingOut ? (

                        <>
                          <Loader2
                            size={17}
                            className="spin"
                          />

                          Logging out...
                        </>

                      ) : (

                        <>
                          <LogOut
                            size={17}
                          />

                          Logout
                        </>

                      )}

                    </button>

                  </div>

                )}

              </div>

            </div>

          </div>

        </header>


        {/* =================================================
            MAIN CONTAINER
            ================================================= */}

        <main className="main-container">


          {/* SEARCH */}

          <section className="search-section">

            <form
              className="search-form"
              onSubmit={
                handleSearchSubmit
              }
            >

              <Search size={20} />

              <input
                type="text"
                value={searchQuery}
                onChange={
                  (event) =>
                    setSearchQuery(
                      event.target.value
                    )
                }
                placeholder="Search for a city..."
                autoComplete="off"
              />

              <button
                type="submit"
                disabled={
                  searchLoading ||
                  !searchQuery.trim()
                }
              >

                {searchLoading
                  ? "Searching..."
                  : "Search"}

              </button>

            </form>


            {/* SEARCH RESULTS */}

            {searchResults.length > 0 && (

              <div className="search-results">

                {searchResults.map(
                  (
                    result,
                    index
                  ) => (

                    <button
                      type="button"
                      className="search-result"
                      key={`${result.name}-${result.latitude}-${index}`}
                      onClick={() =>
                        handleSelectLocation(
                          result
                        )
                      }
                    >

                      <MapPin
                        size={18}
                      />

                      <div>

                        <strong>
                          {result.name}
                        </strong>

                        <span>
                          {[
                            result.state,
                            result.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>

                      </div>

                    </button>

                  )
                )}

              </div>
            )}

          </section>


          {/* =================================================
              QUICK ACTIONS
              ================================================= */}

          <section
            className="quick-actions-section"
            aria-label="WeatherGPT quick actions"
          >

            <div
              className="quick-actions-container"
              ref={moreMenuRef}
            >

              <div className="quick-actions-scroll">


                {/* TRAVEL */}

                <button
                  type="button"
                  className="quick-action-button"
                  onClick={
                    openTravelSafety
                  }
                >

                  <span className="quick-action-icon">
                    🚗
                  </span>

                  <span>
                    Travel Safety
                  </span>

                </button>


                {/* WIND */}

                <button
                  type="button"
                  className="quick-action-button"
                  onClick={
                    openWindMap
                  }
                >

                  <span className="quick-action-icon">
                    🌬️
                  </span>

                  <span>
                    Live Wind
                  </span>

                </button>


                {/* CLIMATE */}

                <button
                  type="button"
                  className="quick-action-button"
                  onClick={
                    openClimateInformation
                  }
                >

                  <span className="quick-action-icon">
                    🌍
                  </span>

                  <span>
                    Climate
                  </span>

                </button>


                {/* VOICE */}

                <button
                  type="button"
                  className="quick-action-button"
                  onClick={
                    openVoiceLanguages
                  }
                >

                  <span className="quick-action-icon">
                    🎤
                  </span>

                  <span>
                    Languages & Voice
                  </span>

                </button>


                {/* MORE */}

                <button
                  type="button"
                  className={`quick-action-button quick-more-button ${
                    moreOpen
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setMoreOpen(
                      (previous) =>
                        !previous
                    )
                  }
                  aria-expanded={
                    moreOpen
                  }
                  aria-label="More options"
                >

                  <MoreHorizontal
                    size={19}
                  />

                  <span>
                    More
                  </span>

                </button>

              </div>


              {/* MORE DROPDOWN */}

              {moreOpen && (

                <div className="more-dropdown quick-more-dropdown">


                  {/* FORECAST */}

                  <button
                    type="button"
                    onClick={() => {

                      scrollToSection(
                        ".forecast-section"
                      );

                      setMoreOpen(false);

                    }}
                  >

                    <span className="more-item-icon">
                      📅
                    </span>

                    <div>

                      <strong>
                        Forecast
                      </strong>

                      <small>
                        Next 7 days
                      </small>

                    </div>

                  </button>


                  {/* WEATHER ALERTS */}

                  <button
                    type="button"
                    onClick={() => {

                      if (
                        document.querySelector(
                          ".weather-alert-section"
                        )
                      ) {

                        scrollToSection(
                          ".weather-alert-section"
                        );

                      } else {

                        setChatMessage(
                          "Are there any weather alerts?"
                        );

                        scrollToSection(
                          ".ai-section"
                        );
                      }

                      setMoreOpen(false);

                    }}
                  >

                    <span className="more-item-icon">
                      ⚠️
                    </span>

                    <div>

                      <strong>
                        Weather Alerts
                      </strong>

                      <small>
                        Check weather warnings
                      </small>

                    </div>

                  </button>

                </div>

              )}

            </div>

          </section>


          {/* =================================================
              WEATHER ERROR
              ================================================= */}

          {weatherError && (

            <div className="weather-error">

              <AlertTriangle
                size={20}
              />

              <span>
                {weatherError}
              </span>

            </div>

          )}


          {/* =================================================
              WEATHER LOADING
              ================================================= */}

          {weatherLoading &&
            !weather && (

              <div className="weather-loading">

                <Loader2
                  className="spin"
                  size={32}
                />

                <p>
                  Loading weather...
                </p>

              </div>

            )}


          {/* =================================================
              WEATHER CONTENT
              ================================================= */}

          {weather && (

            <>


              {/* LOCATION */}

              <section className="location-heading">

                <div>

                  <span>
                    Your weather
                  </span>

                  <h2>

                    <MapPin
                      size={22}
                    />

                    {locationName}

                  </h2>

                  {locationDetails && (

                    <p>

                      {[
                        locationDetails.district,
                        locationDetails.state,
                        locationDetails.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}

                    </p>

                  )}

                </div>


                {/* REFRESH */}

                <button
                  className="refresh-button"
                  onClick={
                    async () => {

                      const active =
                        selectedLocation ||
                        location;

                      if (!active)
                        return;

                      setWeatherLoading(
                        true
                      );

                      setWeatherError("");

                      try {

                        const data =
                          await getWeather(
                            active.latitude,
                            active.longitude
                          );

                        setWeather(
                          data
                        );

                      } catch (error) {

                        setWeatherError(
                          error.message ||
                            "Unable to refresh weather."
                        );

                      } finally {

                        setWeatherLoading(
                          false
                        );

                      }
                    }
                  }
                  title="Refresh weather"
                >

                  <RefreshCw
                    size={18}
                  />

                </button>

              </section>


              {/* =================================================
                  CURRENT WEATHER
                  ================================================= */}

              <section className="current-weather">

                <div className="current-main">

                  <div className="weather-icon">
                    {weatherInfo.icon}
                  </div>

                  <div>

                    <div className="temperature">

                      {Math.round(
                        current?.temperature_2m ??
                          0
                      )}

                      °

                    </div>

                    <div className="weather-description">

                      {weatherInfo.label}

                    </div>

                    <div className="feels-like">

                      Feels like{" "}

                      {Math.round(
                        current?.apparent_temperature ??
                          0
                      )}

                      °

                    </div>

                  </div>

                </div>


                <div className="weather-details">


                  {/* HUMIDITY */}

                  <div className="weather-detail">

                    <Droplets
                      size={21}
                    />

                    <div>

                      <span>
                        Humidity
                      </span>

                      <strong>

                        {current?.relative_humidity_2m ??
                          "--"}

                        %

                      </strong>

                    </div>

                  </div>


                  {/* WIND */}

                  <div className="weather-detail">

                    <Wind
                      size={21}
                    />

                    <div>

                      <span>
                        Wind
                      </span>

                      <strong>

                        {Math.round(
                          current?.wind_speed_10m ??
                            0
                        )}{" "}

                        km/h

                      </strong>

                    </div>

                  </div>


                  {/* RAIN */}

                  <div className="weather-detail">

                    <CloudRain
                      size={21}
                    />

                    <div>

                      <span>
                        Rain
                      </span>

                      <strong>

                        {current?.precipitation ??
                          0}{" "}

                        mm

                      </strong>

                    </div>

                  </div>

                </div>

              </section>


              {/* =================================================
                  WEATHER ALERT
                  ================================================= */}

              {hasAlerts && (

                <section className="weather-alert-section">

                  <div
                    className={`weather-alert-card ${
                      alertData.severity
                        ? alertData.severity.toLowerCase()
                        : "moderate"
                    }`}
                  >

                    <div className="weather-alert-header">

                      <AlertTriangle
                        size={24}
                      />

                      <div>

                        <h3>
                          Weather Alert
                        </h3>

                        <span>
                          {alertData.severity ||
                            "Moderate"}
                        </span>

                      </div>

                    </div>


                    <div className="weather-alert-list">

                      {alertData.alerts.map(
                        (
                          alert,
                          index
                        ) => (

                          <div
                            className="weather-alert"
                            key={index}
                          >

                            <strong>

                              {alert.title ||
                                alert.message ||
                                "Weather warning"}

                            </strong>

                            {alert.description && (

                              <p>
                                {alert.description}
                              </p>

                            )}

                            {alert.message &&
                              alert.title && (

                                <p>
                                  {alert.message}
                                </p>

                              )}

                          </div>

                        )
                      )}

                    </div>

                  </div>

                </section>

              )}


              {/* =================================================
                  AI CHAT
                  ================================================= */}

              <section className="ai-section">


                <div className="ai-heading">

                  <div className="ai-icon">
                    ✨
                  </div>

                  <div>

                    <span>
                      WeatherGPT AI
                    </span>

                    <h2>
                      Ask about your weather
                    </h2>

                  </div>

                </div>


                {/* SUGGESTIONS */}

                <div className="suggestions">


                  <button
                    type="button"
                    onClick={() =>
                      setChatMessage(
                        "Is today safe for travelling?"
                      )
                    }
                  >
                    Is today safe for travelling?
                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      setChatMessage(
                        "Will it rain today?"
                      )
                    }
                  >
                    Will it rain today?
                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      setChatMessage(
                        "What should I carry today?"
                      )
                    }
                  >
                    What should I carry today?
                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      setChatMessage(
                        "How will the weather be tomorrow?"
                      )
                    }
                  >
                    Tomorrow's weather?
                  </button>

                </div>


                {/* AI RESPONSE */}

                {chatMessages.length > 0 && (

                  <div className="ai-response">

                    <div className="ai-response-label">
                      Latest response
                    </div>

                    {chatMessages
                      .filter(
                        (message) =>
                          message.role ===
                          "assistant"
                      )
                      .slice(-1)
                      .map(
                        (
                          message,
                          index
                        ) => (

                          <ReactMarkdown
                            key={index}
                          >
                            {message.content}
                          </ReactMarkdown>

                        )
                      )}

                  </div>

                )}


                {/* CHAT ERROR */}

                {chatError && (

                  <div className="ai-error">

                    <AlertTriangle
                      size={18}
                    />

                    {chatError}

                  </div>

                )}


                {/* CHAT INPUT */}

                <form
                  className="chat-input-container"
                  onSubmit={
                    handleSendMessage
                  }
                >

                  <input
                    type="text"
                    value={chatMessage}
                    onChange={
                      (event) =>
                        setChatMessage(
                          event.target.value
                        )
                    }
                    placeholder={
                      isRecording
                        ? "Listening..."
                        : voiceLoading
                        ? "Converting voice to text..."
                        : "Ask WeatherGPT anything..."
                    }
                    disabled={
                      chatLoading ||
                      isRecording ||
                      voiceLoading
                    }
                  />


                  {/* MICROPHONE */}

                  <button
                    type="button"
                    className={`voice-button ${
                      isRecording
                        ? "recording"
                        : ""
                    }`}
                    onClick={
                      handleVoiceInput
                    }
                    disabled={
                      chatLoading ||
                      voiceLoading
                    }
                    title={
                      isRecording
                        ? "Stop recording"
                        : "Speak to WeatherGPT"
                    }
                  >

                    {voiceLoading ? (

                      <Loader2
                        size={20}
                        className="spin"
                      />

                    ) : isRecording ? (

                      <MicOff
                        size={20}
                      />

                    ) : (

                      <Mic
                        size={20}
                      />

                    )}

                  </button>


                  {/* SEND */}

                  <button
                    type="submit"
                    disabled={
                      chatLoading ||
                      !chatMessage.trim() ||
                      !weather ||
                      isRecording ||
                      voiceLoading
                    }
                    title="Send message"
                  >

                    {chatLoading ? (

                      <Loader2
                        size={20}
                        className="spin"
                      />

                    ) : (

                      <Send
                        size={20}
                      />

                    )}

                  </button>

                </form>

              </section>


              {/* =================================================
                  FORECAST
                  ================================================= */}

              {daily?.time && (

                <section className="forecast-section">


                  <div className="section-title">

                    <div>

                      <span>
                        Next 7 days
                      </span>

                      <h3>
                        Forecast
                      </h3>

                    </div>

                  </div>


                  <div className="forecast-list">

                    {daily.time.map(
                      (
                        date,
                        index
                      ) => {

                        const info =
                          getWeatherDescription(
                            daily
                              .weather_code?.[
                              index
                            ]
                          );

                        const day =
                          new Date(
                            `${date}T12:00:00`
                          ).toLocaleDateString(
                            undefined,
                            {
                              weekday:
                                "short",
                            }
                          );

                        return (

                          <div
                            className="forecast-day"
                            key={date}
                          >

                            <span className="forecast-day-name">

                              {index === 0
                                ? "Today"
                                : day}

                            </span>


                            <span className="forecast-icon">
                              {info.icon}
                            </span>


                            <strong>

                              {Math.round(
                                daily
                                  .temperature_2m_max?.[
                                  index
                                ] ?? 0
                              )}

                              °

                            </strong>


                            <span className="forecast-low">

                              {Math.round(
                                daily
                                  .temperature_2m_min?.[
                                  index
                                ] ?? 0
                              )}

                              °

                            </span>


                            <span className="forecast-rain">

                              💧{" "}

                              {daily
                                .precipitation_probability_max?.[
                                index
                              ] ?? 0}

                              %

                            </span>

                          </div>

                        );
                      }
                    )}

                  </div>

                </section>

              )}

            </>

          )}

        </main>


        {/* =================================================
            FOOTER
            ================================================= */}

        <footer className="footer">

          <p>
            WeatherGPT • AI-powered weather
            intelligence By ~ HackRush
          </p>

        </footer>

      </div>

    </>

  );
}

export default Home;