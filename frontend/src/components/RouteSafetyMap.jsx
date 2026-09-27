import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  ArrowLeft,
  Car,
  Clock3,
  MapPin,
  Navigation,
  Route,
  Search,
  Loader2,
  AlertCircle,
  CloudRain,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";

import { getRoute, getWeather, searchLocation } from "../services/api";

import "maplibre-gl/dist/maplibre-gl.css";
import "./RouteSafetyMap.css";


function formatDuration(minutes) {
  if (minutes == null) return "--";

  const totalMinutes = Math.round(Number(minutes));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (mins === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${mins} min`;
}


function formatDistance(distance) {
  if (distance == null || distance === "") return "--";

  const value = Number(distance);

  if (!Number.isFinite(value)) return "--";

  if (value < 1) {
    return `${Math.round(value * 1000)} m`;
  }

  return `${value.toFixed(1)} km`;
}


function formatRouteDistance(route) {
  if (!route) return "--";

  // Preferred value from our FastAPI response.
  if (route.distance_km != null) {
    return formatDistance(route.distance_km);
  }

  // OSRM returns distance in metres. Support the raw value too.
  if (route.distance != null) {
    const meters = Number(route.distance);

    if (Number.isFinite(meters)) {
      return formatDistance(meters / 1000);
    }
  }

  if (route.distance_meters != null) {
    const meters = Number(route.distance_meters);

    if (Number.isFinite(meters)) {
      return formatDistance(meters / 1000);
    }
  }

  return "--";
}


function formatRouteDuration(route) {
  if (!route) return "--";

  // Preferred value from our FastAPI response.
  if (route.duration_minutes != null) {
    return formatDuration(route.duration_minutes);
  }

  // OSRM returns duration in seconds. Support the raw value too.
  if (route.duration != null) {
    const seconds = Number(route.duration);

    if (Number.isFinite(seconds)) {
      return formatDuration(seconds / 60);
    }
  }

  if (route.duration_seconds != null) {
    const seconds = Number(route.duration_seconds);

    if (Number.isFinite(seconds)) {
      return formatDuration(seconds / 60);
    }
  }

  return "--";
}


function getRouteCoordinates(route) {
  if (!route?.geometry) {
    return [];
  }

  if (
    route.geometry.type === "LineString" &&
    Array.isArray(route.geometry.coordinates)
  ) {
    return route.geometry.coordinates;
  }

  return [];
}


/*
 * Divide a road route into a small number of map segments.
 *
 * We deliberately keep the number of weather requests small.
 * A route with thousands of geometry points does NOT generate
 * thousands of API calls.
 */
function createRouteSegments(coordinates, segmentCount = 10) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return [];
  }

  const count = Math.min(
    segmentCount,
    coordinates.length - 1
  );

  const segments = [];

  for (let index = 0; index < count; index += 1) {
    const startIndex = Math.floor(
      (index * (coordinates.length - 1)) / count
    );

    const endIndex = Math.floor(
      ((index + 1) * (coordinates.length - 1)) / count
    );

    const segmentCoordinates = coordinates.slice(
      startIndex,
      Math.max(endIndex + 1, startIndex + 2)
    );

    if (segmentCoordinates.length < 2) {
      continue;
    }

    /*
     * Use the middle road coordinate as the weather
     * representative point for this segment.
     */
    const middleIndex = Math.floor(
      (segmentCoordinates.length - 1) / 2
    );

    const middle =
      segmentCoordinates[middleIndex];

    segments.push({
      id: index,
      coordinates: segmentCoordinates,
      latitude: Number(middle[1]),
      longitude: Number(middle[0]),
      risk: "low",
      reasons: [],
      weather: null,
    });
  }

  return segments;
}


/*
 * Convert weather conditions into a deterministic travel-risk
 * score. Gemini is NOT used to decide whether a road is safe.
 */
function analyzeSegmentWeather(weather) {
  const current = weather?.current || {};
  const daily = weather?.daily || {};
  const alerts = weather?.alerts || {};

  let score = 0;
  const reasons = [];

  const temperature = Number(
    current.temperature_2m
  );

  const wind = Number(
    current.wind_speed_10m
  );

  const precipitation = Number(
    current.precipitation
  );

  const weatherCode = Number(
    current.weather_code
  );

  const rainProbability = Number(
    daily.precipitation_probability_max?.[0]
  );

  if (Number.isFinite(temperature)) {
    if (temperature >= 42) {
      score += 4;
      reasons.push(
        `Extreme heat: ${Math.round(temperature)}°C`
      );
    } else if (temperature >= 38) {
      score += 2;
      reasons.push(
        `High temperature: ${Math.round(temperature)}°C`
      );
    } else if (temperature >= 35) {
      score += 1;
      reasons.push(
        `High temperature: ${Math.round(temperature)}°C`
      );
    }
  }

  if (Number.isFinite(wind)) {
    if (wind >= 60) {
      score += 4;
      reasons.push(
        `Strong winds: ${Math.round(wind)} km/h`
      );
    } else if (wind >= 40) {
      score += 2;
      reasons.push(
        `Strong winds: ${Math.round(wind)} km/h`
      );
    }
  }

  if (Number.isFinite(precipitation)) {
    if (precipitation >= 10) {
      score += 4;
      reasons.push(
        `Heavy rainfall: ${precipitation} mm`
      );
    } else if (precipitation >= 5) {
      score += 2;
      reasons.push(
        `Rainfall: ${precipitation} mm`
      );
    } else if (precipitation > 0) {
      score += 1;
      reasons.push(
        `Rain detected: ${precipitation} mm`
      );
    }
  }

  /*
   * WMO weather codes:
   * 65/82 = heavy rain/showers
   * 95/96/99 = thunderstorm
   */
  if ([95, 96, 99].includes(weatherCode)) {
    score += 5;
    reasons.push("Thunderstorm conditions");
  } else if ([65, 82].includes(weatherCode)) {
    score += 4;
    reasons.push("Heavy rain conditions");
  } else if (
    [63, 64, 81].includes(weatherCode)
  ) {
    score += 2;
    reasons.push("Moderate rain conditions");
  } else if (
    [61, 80].includes(weatherCode)
  ) {
    score += 1;
    reasons.push("Rain/showers possible");
  }

  if (Number.isFinite(rainProbability)) {
    if (rainProbability >= 90) {
      score += 3;
      reasons.push(
        `${Math.round(rainProbability)}% rain probability`
      );
    } else if (rainProbability >= 80) {
      score += 2;
      reasons.push(
        `${Math.round(rainProbability)}% rain probability`
      );
    } else if (rainProbability >= 60) {
      score += 1;
      reasons.push(
        `${Math.round(rainProbability)}% rain probability`
      );
    }
  }

  /*
   * The existing backend alert engine is also considered.
   */
  if (alerts?.severity === "high") {
    score += 2;
  } else if (alerts?.severity === "moderate") {
    score += 1;
  }

  let risk = "low";

  if (score >= 7) {
    risk = "severe";
  } else if (score >= 4) {
    risk = "high";
  } else if (score >= 2) {
    risk = "moderate";
  }

  return {
    risk,
    score,
    reasons: [...new Set(reasons)],
  };
}


function getRiskColor(risk) {
  switch (risk) {
    case "severe":
      return "#dc2626";

    case "high":
      return "#f97316";

    case "moderate":
      return "#eab308";

    default:
      return "#16a34a";
  }
}


function getRiskLabel(risk) {
  switch (risk) {
    case "severe":
      return "Severe risk";

    case "high":
      return "High risk";

    case "moderate":
      return "Caution";

    default:
      return "Low risk";
  }
}


function getHighestRisk(segments) {
  const order = {
    low: 0,
    moderate: 1,
    high: 2,
    severe: 3,
  };

  return segments.reduce(
    (highest, segment) =>
      order[segment.risk] > order[highest]
        ? segment.risk
        : highest,
    "low"
  );
}


function getRiskSummary(segments) {
  return segments.reduce(
    (summary, segment) => {
      summary[segment.risk] += 1;
      return summary;
    },
    {
      low: 0,
      moderate: 0,
      high: 0,
      severe: 0,
    }
  );
}


function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  inputClassName = "",
}) {
  const wrapperRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const query = value.trim();

    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setSearching(false);
      setActiveIndex(-1);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setSearching(true);

      try {
        const data = await searchLocation(query);
        const results = Array.isArray(data?.results)
          ? data.results.slice(0, 6)
          : [];

        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(-1);
      } catch (error) {
        console.warn("Location suggestions failed:", error);
        setSuggestions([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const formatSuggestion = (result) => {
    const parts = [
      result?.name,
      result?.admin1,
      result?.country,
    ].filter(Boolean);

    return [...new Set(parts)].join(", ");
  };

  const chooseSuggestion = (result) => {
    const label = formatSuggestion(result);

    onSelect({
      ...result,
      label,
    });

    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (!open || suggestions.length === 0) {
      if (event.key === "ArrowDown") {
        setOpen(suggestions.length > 0);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current > 0 ? current - 1 : suggestions.length - 1
      );
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeIndex]);
    }

    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />

      {searching && value.trim().length >= 2 && (
        <Loader2
          size={16}
          className="route-spin"
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#64748b",
            pointerEvents: "none",
          }}
        />
      )}

      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 7px)",
            zIndex: 100,
            background: "#ffffff",
            border: "1px solid #dbe3ef",
            borderRadius: "12px",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.16)",
            overflow: "hidden",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          {suggestions.map((result, index) => {
            const label = formatSuggestion(result);
            const isActive = activeIndex === index;

            return (
              <button
                key={`${result.id ?? label}-${result.latitude}-${result.longitude}`}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseDown={(event) => {
                  // Prevent the input blur from hiding the dropdown first.
                  event.preventDefault();
                }}
                onClick={() => chooseSuggestion(result)}
                style={{
                  width: "100%",
                  border: 0,
                  borderBottom:
                    index === suggestions.length - 1
                      ? "0"
                      : "1px solid #eef2f7",
                  background: isActive ? "#f1f5f9" : "#ffffff",
                  padding: "11px 13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <MapPin
                  size={17}
                  style={{
                    color: "#2563eb",
                    flexShrink: 0,
                  }}
                />

                <span style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#0f172a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {result?.name || label}
                  </strong>

                  <span
                    style={{
                      display: "block",
                      marginTop: "2px",
                      fontSize: "11px",
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


function RouteSafetyMap({
  onClose,
  initialOrigin = "",
  initialDestination = "",
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const [origin, setOrigin] =
    useState(initialOrigin);

  const [destination, setDestination] =
    useState(initialDestination);

  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [safetyLoading, setSafetyLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [routeSafety, setRouteSafety] =
    useState(null);

  const [selectedHazard, setSelectedHazard] =
    useState(null);


  /*
   * ---------------------------------------------------------
   * CREATE MAP
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,

      style:
        "https://tiles.openfreemap.org/styles/liberty",

      center: [78.9629, 20.5937],

      zoom: 4.5,

      attributionControl: true,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl(),
      "bottom-right"
    );

    map.on("load", () => {
      map.resize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);


  /*
   * ---------------------------------------------------------
   * RESIZE MAP
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.resize();
    }, 100);

    return () => clearTimeout(timer);
  }, []);


  /*
   * ---------------------------------------------------------
   * DRAW ROUTE
   * ---------------------------------------------------------
   */

  const drawRoute = (route) => {
    const map = mapRef.current;

    if (!map || !route) {
      return;
    }

    const coordinates =
      getRouteCoordinates(route);

    if (coordinates.length < 2) {
      return;
    }

    const sourceId =
      "weathergpt-route";

    const routeFeature = {
      type: "Feature",
      properties: {},
      geometry: route.geometry,
    };


    /*
     * Remove previous route source/layers.
     */

    if (
      map.getLayer(
        "weathergpt-route-line"
      )
    ) {
      map.removeLayer(
        "weathergpt-route-line"
      );
    }

    if (
      map.getLayer(
        "weathergpt-route-outline"
      )
    ) {
      map.removeLayer(
        "weathergpt-route-outline"
      );
    }

    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }


    /*
     * Add route source.
     */

    map.addSource(sourceId, {
      type: "geojson",
      data: routeFeature,
    });


    /*
     * Outer route line.
     */

    map.addLayer({
      id:
        "weathergpt-route-outline",

      type: "line",

      source: sourceId,

      paint: {
        "line-color": "#ffffff",
        "line-width": 8,
        "line-opacity": 0.9,
      },
    });


    /*
     * Main route line.
     */

    map.addLayer({
      id:
        "weathergpt-route-line",

      type: "line",

      source: sourceId,

      paint: {
        "line-color": "#2563eb",
        "line-width": 5,
        "line-opacity": 0.95,
      },
    });


    /*
     * Fit map to route.
     */

    const bounds =
      coordinates.reduce(
        (boundsObject, coordinate) => {
          return boundsObject.extend(
            coordinate
          );
        },
        new maplibregl.LngLatBounds(
          coordinates[0],
          coordinates[0]
        )
      );

    map.fitBounds(bounds, {
      padding: {
        top: 120,
        bottom: 160,
        left: 80,
        right: 80,
      },

      duration: 1000,

      maxZoom: 12,
    });
  };


  /*
   * ---------------------------------------------------------
   * DRAW SAFETY SEGMENTS
   * ---------------------------------------------------------
   */

  const drawSafetySegments = (
    segments
  ) => {
    const map = mapRef.current;

    if (!map || !segments?.length) {
      return;
    }

    const sourceId =
      "weathergpt-safety-segments";

    const featureCollection = {
      type: "FeatureCollection",

      features: segments.map(
        (segment) => ({
          type: "Feature",

          properties: {
            risk: segment.risk,
            riskColor:
              getRiskColor(
                segment.risk
              ),
          },

          geometry: {
            type: "LineString",
            coordinates:
              segment.coordinates,
          },
        })
      ),
    };


    /*
     * Remove old safety layer.
     */

    if (
      map.getLayer(
        "weathergpt-safety-outline"
      )
    ) {
      map.removeLayer(
        "weathergpt-safety-outline"
      );
    }

    if (
      map.getLayer(
        "weathergpt-safety-segment-line"
      )
    ) {
      map.removeLayer(
        "weathergpt-safety-segment-line"
      );
    }

    if (
      map.getSource(sourceId)
    ) {
      map.removeSource(sourceId);
    }


    map.addSource(sourceId, {
      type: "geojson",
      data: featureCollection,
    });


    /*
     * White border makes the colored route
     * visible over the map.
     */

    map.addLayer({
      id:
        "weathergpt-safety-outline",

      type: "line",

      source: sourceId,

      paint: {
        "line-color": "#ffffff",
        "line-width": 8,
        "line-opacity": 0.95,
      },
    });


    /*
     * Data-driven route colors.
     */

    map.addLayer({
      id:
        "weathergpt-safety-segment-line",

      type: "line",

      source: sourceId,

      paint: {
        "line-color": [
          "match",
          ["get", "risk"],
          "severe",
          "#dc2626",
          "high",
          "#f97316",
          "moderate",
          "#eab308",
          "#16a34a",
        ],

        "line-width": 5,

        "line-opacity": 0.98,
      },
    });


    /*
     * Put the safety layer above the normal route.
     */

    if (
      map.getLayer(
        "weathergpt-safety-segment-line"
      )
    ) {
      map.moveLayer(
        "weathergpt-safety-segment-line"
      );
    }
  };


  /*
   * ---------------------------------------------------------
   * DRAW HAZARD MARKERS
   * ---------------------------------------------------------
   */

  const drawHazardMarkers = (
    segments
  ) => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const oldMarkers =
      document.querySelectorAll(
        ".weathergpt-hazard-marker"
      );

    oldMarkers.forEach(
      (marker) => marker.remove()
    );

    segments
      .filter(
        (segment) =>
          segment.risk === "moderate" ||
          segment.risk === "high" ||
          segment.risk === "severe"
      )
      .forEach((segment) => {
        const element =
          document.createElement("button");

        element.type = "button";
        element.className =
          `weathergpt-hazard-marker risk-${segment.risk}`;

        element.title =
          `${getRiskLabel(segment.risk)}: ${
            segment.reasons.join(", ")
          }`;

        element.innerHTML = `
          <span class="weathergpt-hazard-marker-icon">
            ${segment.risk === "severe" ? "⛔" : "⚠️"}
          </span>
        `;

        element.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();
            setSelectedHazard(segment);
          }
        );

        new maplibregl.Marker({
          element,
          anchor: "center",
        })
          .setLngLat([
            segment.longitude,
            segment.latitude,
          ])
          .addTo(map);
      });
  };


  /*
   * ---------------------------------------------------------
   * ANALYZE WEATHER ALONG ROUTE
   * ---------------------------------------------------------
   */

  const analyzeRouteSafety = async (
    route
  ) => {
    const coordinates =
      getRouteCoordinates(route);

    if (coordinates.length < 2) {
      return;
    }

    setSafetyLoading(true);
    setSelectedHazard(null);

    try {
      const segments =
        createRouteSegments(
          coordinates,
          10
        );

      /*
       * Fetch weather for all representative
       * points in parallel. Only ~10 calls are
       * made for a complete route.
       */
      const weatherResults =
        await Promise.all(
          segments.map(
            async (segment) => {
              try {
                const weather =
                  await getWeather(
                    segment.latitude,
                    segment.longitude
                  );

                const analysis =
                  analyzeSegmentWeather(
                    weather
                  );

                return {
                  ...segment,
                  weather,
                  ...analysis,
                };
              } catch (weatherError) {
                console.warn(
                  "Weather analysis failed for route segment:",
                  weatherError
                );

                return {
                  ...segment,
                  risk: "low",
                  score: 0,
                  reasons: [
                    "Weather data unavailable"
                  ],
                  weather: null,
                };
              }
            }
          )
        );

      setRouteSafety({
        segments: weatherResults,
        highestRisk:
          getHighestRisk(
            weatherResults
          ),
        summary:
          getRiskSummary(
            weatherResults
          ),
        updatedAt:
          new Date(),
      });

      drawSafetySegments(
        weatherResults
      );

      drawHazardMarkers(
        weatherResults
      );
    } finally {
      setSafetyLoading(false);
    }
  };


  /*
   * ---------------------------------------------------------
   * DRAW MARKERS
   * ---------------------------------------------------------
   */

  const drawMarkers = (route) => {
    const map = mapRef.current;

    if (!map || !route) {
      return;
    }

    const oldMarkers =
      document.querySelectorAll(
        ".weathergpt-route-marker"
      );

    oldMarkers.forEach(
      (marker) => marker.remove()
    );


    /*
     * Origin marker.
     */

    if (route.origin) {
      const originElement =
        document.createElement("div");

      originElement.className =
        "weathergpt-route-marker weathergpt-origin-marker";

      originElement.innerHTML = `
        <span class="weathergpt-marker-dot"></span>
      `;

      new maplibregl.Marker({
        element: originElement,
      })
        .setLngLat([
          route.origin.longitude,
          route.origin.latitude,
        ])
        .addTo(map);
    }


    /*
     * Destination marker.
     */

    if (route.destination) {
      const destinationElement =
        document.createElement("div");

      destinationElement.className =
        "weathergpt-route-marker weathergpt-destination-marker";

      destinationElement.innerHTML = `
        <span class="weathergpt-marker-dot"></span>
      `;

      new maplibregl.Marker({
        element: destinationElement,
      })
        .setLngLat([
          route.destination.longitude,
          route.destination.latitude,
        ])
        .addTo(map);
    }
  };


  /*
   * ---------------------------------------------------------
   * LOAD ROUTE
   * ---------------------------------------------------------
   */

  const handleFindRoute = async (
    event
  ) => {
    event.preventDefault();

    const cleanOrigin =
      origin.trim();

    const cleanDestination =
      destination.trim();

    if (!cleanOrigin) {
      setError(
        "Please enter your starting location."
      );
      return;
    }

    if (!cleanDestination) {
      setError(
        "Please enter your destination."
      );
      return;
    }

    if (
      cleanOrigin.toLowerCase() ===
      cleanDestination.toLowerCase()
    ) {
      setError(
        "Origin and destination cannot be the same."
      );
      return;
    }

    setLoading(true);
    setSafetyLoading(false);
    setError("");
    setRoutes([]);
    setSelectedRouteIndex(0);
    setRouteSafety(null);
    setSelectedHazard(null);

    try {
      const data =
        await getRoute(
          cleanOrigin,
          cleanDestination,
          true
        );

      if (
        !data ||
        data.success !== true
      ) {
        throw new Error(
          "Unable to calculate the route."
        );
      }

      const returnedRoutes =
        Array.isArray(data.routes)
          ? data.routes
          : [];

      if (
        returnedRoutes.length === 0
      ) {
        throw new Error(
          "No road route was found between these locations."
        );
      }

      /*
       * Normalize route metrics. The backend may return the
       * already-converted distance_km/duration_minutes fields,
       * or raw OSRM distance (metres) / duration (seconds).
       * Keeping both forms supported prevents the route card
       * from showing "--" when the API response shape changes.
       */
      const normalizedRoutes =
        returnedRoutes.map((route) => ({
          ...route,
          distance_km:
            route.distance_km != null
              ? Number(route.distance_km)
              : route.distance != null
              ? Number(route.distance) / 1000
              : route.distance_meters != null
              ? Number(route.distance_meters) / 1000
              : null,
          duration_minutes:
            route.duration_minutes != null
              ? Number(route.duration_minutes)
              : route.duration != null
              ? Number(route.duration) / 60
              : route.duration_seconds != null
              ? Number(route.duration_seconds) / 60
              : null,
        }));

      setRoutes(normalizedRoutes);
      setSelectedRouteIndex(0);

      setTimeout(() => {
        drawRoute(
          normalizedRoutes[0]
        );

        drawMarkers({
          origin: data.origin,
          destination:
            data.destination,
        });

        /*
         * Safety analysis starts after
         * the route is visible.
         */
        analyzeRouteSafety(
          returnedRoutes[0]
        );
      }, 100);

    } catch (requestError) {
      console.error(
        "Route calculation error:",
        requestError
      );

      setError(
        requestError.message ||
          "Unable to calculate the route."
      );
    } finally {
      setLoading(false);
    }
  };


  /*
   * ---------------------------------------------------------
   * SELECT ALTERNATIVE ROUTE
   * ---------------------------------------------------------
   */

  const handleSelectRoute = (
    index
  ) => {
    const route = routes[index];

    if (!route) {
      return;
    }

    setSelectedRouteIndex(index);
    setRouteSafety(null);
    setSelectedHazard(null);

    drawRoute(route);

    analyzeRouteSafety(route);
  };


  /*
   * ---------------------------------------------------------
   * REFRESH SAFETY
   * ---------------------------------------------------------
   */

  const handleRefreshSafety = () => {
    const route =
      routes[selectedRouteIndex];

    if (!route || safetyLoading) {
      return;
    }

    analyzeRouteSafety(route);
  };


  /*
   * ---------------------------------------------------------
   * SWAP LOCATIONS
   * ---------------------------------------------------------
   */

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
  };


  /*
   * ---------------------------------------------------------
   * CLEAN HAZARD MARKERS ON UNMOUNT
   * ---------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      document
        .querySelectorAll(
          ".weathergpt-hazard-marker, .weathergpt-route-marker"
        )
        .forEach(
          (marker) => marker.remove()
        );
    };
  }, []);


  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  const selectedRoute =
    routes[selectedRouteIndex] ||
    null;

  const highestRisk =
    routeSafety?.highestRisk ||
    "low";

  const safetySummary =
    routeSafety?.summary || {
      low: 0,
      moderate: 0,
      high: 0,
      severe: 0,
    };


  return (
    <div className="route-safety-page">

      {/* HEADER */}

      <header className="route-safety-header">

        <div className="route-header-left">

          <button
            type="button"
            className="route-back-button"
            onClick={onClose}
            aria-label="Close route planner"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1>
              Travel Safety
            </h1>

            <p>
              Weather-aware route planning
            </p>
          </div>

        </div>

        <div className="route-header-badge">
          <Navigation size={15} />
          <span>
            WeatherGPT
          </span>
        </div>

      </header>


      {/* SEARCH PANEL */}

      <div className="route-search-panel">

        <form
          className="route-search-form"
          onSubmit={handleFindRoute}
        >

          <div className="route-input-group">

            <div className="route-input-icon origin">
              <MapPin size={18} />
            </div>

            <LocationAutocomplete
              value={origin}
              onChange={setOrigin}
              onSelect={(location) =>
                setOrigin(location.label)
              }
              placeholder="Starting location"
            />

          </div>


          <button
            type="button"
            className="route-swap-button"
            onClick={handleSwap}
            title="Swap locations"
            aria-label="Swap locations"
          >
            ⇅
          </button>


          <div className="route-input-group">

            <div className="route-input-icon destination">
              <MapPin size={18} />
            </div>

            <LocationAutocomplete
              value={destination}
              onChange={setDestination}
              onSelect={(location) =>
                setDestination(location.label)
              }
              placeholder="Destination"
            />

          </div>


          <button
            type="submit"
            className="route-find-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2
                  size={18}
                  className="route-spin"
                />
                <span>
                  Finding route...
                </span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>
                  Find Route
                </span>
              </>
            )}
          </button>

        </form>


        {error && (
          <div className="route-error">
            <AlertCircle size={17} />
            <span>
              {error}
            </span>
          </div>
        )}

      </div>


      {/* MAP */}

      <main className="route-map-wrapper">

        <div
          ref={mapContainerRef}
          className="route-map"
        />


        {/* MAP EMPTY STATE */}

        {!loading &&
          routes.length === 0 &&
          !error && (
            <div className="route-map-empty">

              <div className="route-empty-icon">
                <Route size={32} />
              </div>

              <h2>
                Plan your journey
              </h2>

              <p>
                Enter any starting location
                and destination to see the
                road route and weather risks.
              </p>

            </div>
          )}


        {/* LOADING OVERLAY */}

        {loading && (
          <div className="route-loading-overlay">

            <div className="route-loading-card">

              <Loader2
                size={30}
                className="route-spin"
              />

              <strong>
                Calculating route
              </strong>

              <span>
                Finding the best road path...
              </span>

            </div>

          </div>
        )}


        {/* SAFETY LEGEND */}

        {selectedRoute && (
          <div className="route-safety-legend">

            <strong>
              Route safety
            </strong>

            <div className="route-legend-items">

              <span>
                <i className="legend-dot low" />
                Low
              </span>

              <span>
                <i className="legend-dot moderate" />
                Caution
              </span>

              <span>
                <i className="legend-dot high" />
                High
              </span>

              <span>
                <i className="legend-dot severe" />
                Severe
              </span>

            </div>

          </div>
        )}


        {/* ROUTE INFORMATION */}

        {selectedRoute && (
          <div className="route-info-card">

            <div className="route-info-top">

              <div>
                <span className="route-info-label">
                  Selected route
                </span>

                <strong>
                  Route {selectedRouteIndex + 1}
                </strong>
              </div>

              <div className="route-source">
                OpenStreetMap
              </div>

            </div>


            <div className="route-stats">

              <div className="route-stat">
                <Route size={18} />

                <div>
                  <span>
                    Distance
                  </span>

                  <strong>
                    {formatRouteDistance(selectedRoute)}
                  </strong>
                </div>
              </div>


              <div className="route-stat">
                <Clock3 size={18} />

                <div>
                  <span>
                    Estimated time
                  </span>

                  <strong>
                    {formatRouteDuration(selectedRoute)}
                  </strong>
                </div>
              </div>


              <div className="route-stat">
                <Car size={18} />

                <div>
                  <span>
                    Travel mode
                  </span>

                  <strong>
                    Driving
                  </strong>
                </div>
              </div>

            </div>


            {/* ALTERNATIVE ROUTES */}

            {routes.length > 1 && (
              <div className="route-alternatives">

                <div className="route-alternatives-title">
                  Alternative routes
                </div>

                <div className="route-alternative-list">

                  {routes.map(
                    (route, index) => (
                      <button
                        key={
                          route.id ??
                          index
                        }
                        type="button"
                        className={
                          `route-alternative ${
                            selectedRouteIndex ===
                            index
                              ? "active"
                              : ""
                          }`
                        }
                        onClick={() =>
                          handleSelectRoute(
                            index
                          )
                        }
                      >

                        <span>
                          Route {index + 1}
                        </span>

                        <strong>
                          {formatRouteDistance(route)}
                        </strong>

                        <small>
                          {formatRouteDuration(route)}
                        </small>

                      </button>
                    )
                  )}

                </div>

              </div>
            )}


            {/* SAFETY ANALYSIS */}

            <div
              className="route-safety-analysis"
              style={{
                marginTop: "14px",
                padding: "14px",
                border: "1px solid #e5e7eb",
                borderRadius: "14px",
                background: "#f8fafc",
              }}
            >

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >

                  {safetyLoading ? (
                    <Loader2
                      size={20}
                      className="route-spin"
                    />
                  ) : (
                    <ShieldAlert
                      size={20}
                    />
                  )}

                  <div>
                    <strong>
                      {safetyLoading
                        ? "Analyzing weather along route..."
                        : `Route status: ${getRiskLabel(
                            highestRisk
                          )}`}
                    </strong>

                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      {safetyLoading
                        ? "Checking multiple points along the road."
                        : routeSafety
                        ? `${safetySummary.low} low · ${safetySummary.moderate} caution · ${safetySummary.high} high · ${safetySummary.severe} severe`
                        : "Weather risk analysis has not started yet."}
                    </div>
                  </div>

                </div>


                {routeSafety && !safetyLoading && (
                  <button
                    type="button"
                    onClick={
                      handleRefreshSafety
                    }
                    title="Refresh route safety"
                    aria-label="Refresh route safety"
                    style={{
                      border: "1px solid #dbe3ef",
                      background: "#ffffff",
                      borderRadius: "10px",
                      width: "36px",
                      height: "36px",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <RefreshCw
                      size={17}
                    />
                  </button>
                )}

              </div>


              {!safetyLoading &&
                routeSafety && (
                  <div
                    style={{
                      marginTop: "12px",
                      display: "grid",
                      gap: "8px",
                    }}
                  >

                    {routeSafety.segments
                      .filter(
                        (segment) =>
                          segment.risk !== "low"
                      )
                      .slice(0, 4)
                      .map(
                        (segment) => (
                          <button
                            type="button"
                            key={segment.id}
                            onClick={() =>
                              setSelectedHazard(
                                segment
                              )
                            }
                            style={{
                              textAlign: "left",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                              borderRadius: "10px",
                              padding: "10px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "9px",
                            }}
                          >

                            <CloudRain
                              size={18}
                              style={{
                                color:
                                  getRiskColor(
                                    segment.risk
                                  ),
                                flexShrink: 0,
                              }}
                            />

                            <span>
                              <strong
                                style={{
                                  display:
                                    "block",
                                  fontSize:
                                    "13px",
                                }}
                              >
                                {getRiskLabel(
                                  segment.risk
                                )}
                              </strong>

                              <span
                                style={{
                                  display:
                                    "block",
                                  marginTop:
                                    "3px",
                                  fontSize:
                                    "12px",
                                  color:
                                    "#64748b",
                                  lineHeight:
                                    "1.35",
                                }}
                              >
                                {segment.reasons
                                  .slice(
                                    0,
                                    2
                                  )
                                  .join(
                                    " • "
                                  )}
                              </span>
                            </span>

                          </button>
                        )
                      )}

                    {routeSafety.segments.every(
                      (segment) =>
                        segment.risk ===
                        "low"
                    ) && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#166534",
                          background: "#f0fdf4",
                          borderRadius: "10px",
                          padding: "10px",
                        }}
                      >
                        No significant weather
                        risk was detected at
                        the sampled route points.
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                      }}
                    >
                      <AlertCircle
                        size={13}
                      />
                      Weather risk is based on
                      sampled forecast points.
                      It does not confirm road
                      closures, landslides or
                      construction.
                    </div>

                  </div>
                )}

            </div>

          </div>
        )}


        {/* SELECTED HAZARD DETAIL */}

        {selectedHazard && (
          <div
            className="route-hazard-detail"
            style={{
              position: "absolute",
              right: "20px",
              top: "20px",
              width: "300px",
              maxWidth:
                "calc(100% - 40px)",
              zIndex: 20,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "14px",
              boxShadow:
                "0 12px 30px rgba(15,23,42,0.16)",
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent:
                  "space-between",
                gap: "10px",
              }}
            >

              <div>
                <strong>
                  {getRiskLabel(
                    selectedHazard.risk
                  )}
                </strong>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  Route weather hazard
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedHazard(null)
                }
                aria-label="Close hazard details"
                style={{
                  border: 0,
                  background: "transparent",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>

            </div>


            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gap: "7px",
              }}
            >

              {selectedHazard.reasons.map(
                (reason, index) => (
                  <div
                    key={`${reason}-${index}`}
                    style={{
                      fontSize: "12px",
                      color: "#334155",
                      display: "flex",
                      gap: "7px",
                    }}
                  >
                    <span>⚠️</span>
                    <span>
                      {reason}
                    </span>
                  </div>
                )
              )}

            </div>


            <div
              style={{
                marginTop: "12px",
                paddingTop: "10px",
                borderTop:
                  "1px solid #e2e8f0",
                fontSize: "11px",
                color: "#64748b",
              }}
            >
              Source: Open-Meteo forecast
              <br />
              Weather point:
              {" "}
              {selectedHazard.latitude.toFixed(
                3
              )}
              ,{" "}
              {selectedHazard.longitude.toFixed(
                3
              )}
              <br />
              Checked:{" "}
              {routeSafety?.updatedAt
                ? routeSafety.updatedAt.toLocaleTimeString()
                : "--"}
            </div>

          </div>
        )}

      </main>

    </div>
  );
}

export default RouteSafetyMap;
