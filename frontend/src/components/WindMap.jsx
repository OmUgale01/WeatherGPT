import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Map,
  Marker,
  NavigationControl,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import "./WindMap.css";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

function WindMap({
  location,
  locationName,
  onClose,
}) {
  const mapContainerRef =
    useRef(null);

  const mapRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const animationRef =
    useRef(null);

  const particlesRef =
    useRef([]);

  const markerRef =
    useRef(null);

  const [windData, setWindData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * LOAD WIND DATA
   */
  useEffect(() => {
    const loadWindData = async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${API_BASE}/api/wind-map`
          );

        if (!response.ok) {
          throw new Error(
            "Unable to load wind data."
          );
        }

        const data =
          await response.json();

        console.log(
          "Wind data:",
          data
        );

        setWindData(data);
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "Unable to load wind data."
        );
      } finally {
        setLoading(false);
      }
    };

    loadWindData();
  }, []);

  /*
   * CREATE MAP
   */
  useEffect(() => {
    if (
      !mapContainerRef.current ||
      mapRef.current
    ) {
      return;
    }

    const lat =
      Number(location?.latitude);

    const lon =
      Number(location?.longitude);

    const hasLocation =
      Number.isFinite(lat) &&
      Number.isFinite(lon);

    const map =
      new Map({
        container:
          mapContainerRef.current,

        style:
          "https://tiles.openfreemap.org/styles/dark",

        center:
          hasLocation
            ? [lon, lat]
            : [78, 20],

        zoom:
          hasLocation
            ? 4
            : 2.8,

        minZoom: 1.5,

        maxZoom: 8,

        renderWorldCopies: true,

        attributionControl: true,
      });

    mapRef.current = map;

    map.addControl(
      new NavigationControl({
        showCompass: true,
        showZoom: true,
      }),
      "top-right"
    );

    map.on("load", () => {
      /*
       * Wind canvas above map.
       */
      const canvas =
        canvasRef.current;

      if (canvas) {
        canvas.style.display =
          "block";
      };

      /*
       * Resize map.
       */
      setTimeout(() => {
        map.resize();
      }, 200);
    });

    map.on("error", (event) => {
      console.error(
        "MapLibre error:",
        event
      );
    });

    return () => {
      if (
        markerRef.current
      ) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      map.remove();

      mapRef.current = null;
    };
  }, []);

  /*
   * USER LOCATION MARKER
   */
  useEffect(() => {
    if (
      !mapRef.current ||
      !location
    ) {
      return;
    }

    const lat =
      Number(location.latitude);

    const lon =
      Number(location.longitude);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      return;
    }

    if (
      markerRef.current
    ) {
      markerRef.current.remove();
    }

    const markerElement =
      document.createElement(
        "div"
      );

    markerElement.className =
      "wind-location-marker";

    markerElement.innerHTML = `
      <span class="wind-marker-dot"></span>
      <span class="wind-marker-label">
        ${locationName || "Your Location"}
      </span>
    `;

    const marker =
      new Marker({
        element:
          markerElement,
      })
        .setLngLat([
          lon,
          lat,
        ])
        .addTo(
          mapRef.current
        );

    markerRef.current =
      marker;
  }, [
    location,
    locationName,
  ]);

  /*
   * WIND PARTICLE CANVAS
   */
  useEffect(() => {
    if (
      !windData?.points?.length
    ) {
      return;
    }

    const canvas =
      canvasRef.current;

    const map =
      mapRef.current;

    if (!canvas || !map) {
      return;
    }

    const ctx =
      canvas.getContext("2d");

    let width = 0;
    let height = 0;

    /*
     * Resize canvas.
     */
    const resizeCanvas = () => {
      const mapElement =
        mapContainerRef.current;

      if (!mapElement) {
        return;
      }

      const rect =
        mapElement.getBoundingClientRect();

      const dpr =
        Math.min(
          window.devicePixelRatio ||
            1,
          2
        );

      width =
        rect.width;

      height =
        rect.height;

      canvas.width =
        width * dpr;

      canvas.height =
        height * dpr;

      canvas.style.width =
        `${width}px`;

      canvas.style.height =
        `${height}px`;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );
    };

    resizeCanvas();

    const handleResize = () => {
      resizeCanvas();
      buildWindField();
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    /*
     * Convert geographic
     * coordinates to screen.
     */
    const project = (
      latitude,
      longitude
    ) => {
      const point =
        map.project([
          Number(longitude),
          Number(latitude),
        ]);

      return {
        x: point.x,
        y: point.y,
      };
    };

    /*
     * Build a smooth interpolated wind field.
     * Using one nearest point caused abrupt direction changes.
     */
    let field = null;

    const buildWindField = () => {
      const projectedPoints = windData.points
        .map((point) => {
          const projected = project(point.lat, point.lon);
          const speed = Number(point.speed) || 0;
          const direction = Number(point.direction) || 0;
          const radians = ((direction + 180) * Math.PI) / 180;

          return {
            x: projected.x,
            y: projected.y,
            speed,
            vx: Math.sin(radians),
            vy: -Math.cos(radians),
          };
        })
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

      if (!projectedPoints.length) {
        field = null;
        return;
      }

      const spacing = 55;
      const columns = Math.max(2, Math.ceil(width / spacing) + 1);
      const rows = Math.max(2, Math.ceil(height / spacing) + 1);
      const nodes = new Array(columns * rows);

      for (let row = 0; row < rows; row++) {
        const y = Math.min(height, row * spacing);
        for (let column = 0; column < columns; column++) {
          const x = Math.min(width, column * spacing);

          const nearest = projectedPoints
            .map((point) => {
              const dx = point.x - x;
              const dy = point.y - y;
              return { point, distanceSquared: dx * dx + dy * dy };
            })
            .sort((a, b) => a.distanceSquared - b.distanceSquared)
            .slice(0, 8);

          let totalWeight = 0;
          let vx = 0;
          let vy = 0;
          let speed = 0;

          nearest.forEach(({ point, distanceSquared }) => {
            const weight = 1 / Math.max(Math.sqrt(distanceSquared), 12);
            totalWeight += weight;
            vx += point.vx * weight;
            vy += point.vy * weight;
            speed += point.speed * weight;
          });

          if (totalWeight) {
            vx /= totalWeight;
            vy /= totalWeight;
            speed /= totalWeight;
          }

          const magnitude = Math.hypot(vx, vy) || 1;
          nodes[row * columns + column] = {
            vx: vx / magnitude,
            vy: vy / magnitude,
            speed,
          };
        }
      }

      field = { spacing, columns, rows, nodes };
    };

    const getInterpolatedWind = (x, y) => {
      if (!field) return null;

      const gx = Math.max(0, Math.min(field.columns - 1.001, x / field.spacing));
      const gy = Math.max(0, Math.min(field.rows - 1.001, y / field.spacing));
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = Math.min(x0 + 1, field.columns - 1);
      const y1 = Math.min(y0 + 1, field.rows - 1);
      const tx = gx - x0;
      const ty = gy - y0;

      const a = field.nodes[y0 * field.columns + x0];
      const b = field.nodes[y0 * field.columns + x1];
      const c = field.nodes[y1 * field.columns + x0];
      const d = field.nodes[y1 * field.columns + x1];
      if (!a || !b || !c || !d) return null;

      const lerp = (p, q, t) => p + (q - p) * t;
      const topVx = lerp(a.vx, b.vx, tx);
      const bottomVx = lerp(c.vx, d.vx, tx);
      const topVy = lerp(a.vy, b.vy, tx);
      const bottomVy = lerp(c.vy, d.vy, tx);
      const topSpeed = lerp(a.speed, b.speed, tx);
      const bottomSpeed = lerp(c.speed, d.speed, tx);

      return {
        vx: lerp(topVx, bottomVx, ty),
        vy: lerp(topVy, bottomVy, ty),
        speed: lerp(topSpeed, bottomSpeed, ty),
      };
    };

    const createParticles = () => {
      const particles = [];
      const count = Math.min(1900, Math.max(900, Math.floor((width * height) / 850)));

      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          age: Math.random() * 140,
          maxAge: 100 + Math.random() * 150,
          trail: [],
        });
      }

      particlesRef.current = particles;
    };

    resizeCanvas();
    buildWindField();
    createParticles();

    /*
     * Wind color.
     */
    const getWindColor =
      (speed, alpha) => {
        if (speed >= 45) {
          return `rgba(255, 105, 70, ${alpha})`;
        }

        if (speed >= 30) {
          return `rgba(255, 205, 65, ${alpha})`;
        }

        if (speed >= 15) {
          return `rgba(55, 220, 170, ${alpha})`;
        }

        return `rgba(80, 175, 255, ${alpha})`;
      };

    /*
     * Animation.
     */
    const animate = () => {
      /*
 * Clear only the previous
 * wind particles.
 *
 * IMPORTANT:
 * Do NOT paint a background here.
 * The MapLibre map must remain visible.
 */
ctx.clearRect(
  0,
  0,
  width,
  height
);

      for (
        const particle of
        particlesRef.current
      ) {
        const wind =
          getInterpolatedWind(
            particle.x,
            particle.y
          );

        if (!wind) {
          particle.x =
            Math.random() *
            width;

          particle.y =
            Math.random() *
            height;

          continue;
        }

        const speed =
          Number(wind.speed) || 0;

        // Stronger visual movement while preserving relative wind speed.
        const velocity =
          Math.max(
            0.65,
            Math.min(
              7.5,
              0.48 + speed / 8.5
            )
          );

        const oldX =
          particle.x;

        const oldY =
          particle.y;

        particle.x += wind.vx * velocity;
        particle.y += wind.vy * velocity;

        particle.trail.push({ x: oldX, y: oldY });
        if (particle.trail.length > 7) {
          particle.trail.shift();
        }

        particle.age++;

        /*
         * Respawn.
         */
        if (
          particle.age >
            particle.maxAge ||
          particle.x <
            -30 ||
          particle.x >
            width + 30 ||
          particle.y <
            -30 ||
          particle.y >
            height + 30
        ) {
          particle.x =
            Math.random() *
            width;

          particle.y =
            Math.random() *
            height;

          particle.age = 0;

          particle.maxAge =
            100 +
            Math.random() *
              150;
          particle.trail = [];

          continue;
        }

        /*
         * Particle brightness.
         */
        const intensity =
          Math.min(
            1,
            speed / 60
          );

        const alpha =
          0.48 +
          intensity * 0.47;

        /*
         * Draw a visible trailing streamline.
         */
        ctx.beginPath();

        const trail = particle.trail;
        if (trail.length > 0) {
          ctx.moveTo(trail[0].x, trail[0].y);
          for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
          }
          ctx.lineTo(particle.x, particle.y);
        } else {
          ctx.moveTo(oldX, oldY);
          ctx.lineTo(particle.x, particle.y);
        }

        ctx.strokeStyle = getWindColor(speed, Math.min(0.95, alpha + 0.18));
        ctx.lineWidth = speed >= 40 ? 1.8 : speed >= 15 ? 1.35 : 1.05;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      animationRef.current =
        requestAnimationFrame(
          animate
        );
    };

    /*
     * Keep the canvas transparent so the MapLibre basemap remains visible.
     */
    ctx.clearRect(0, 0, width, height);

    animate();

    /*
     * Recalculate particles
     * when map moves.
     */
    const handleMapMove =
      () => {
        /*
         * Canvas follows the map and the wind field is rebuilt so
         * directions remain smooth after panning/zooming.
         */
        resizeCanvas();
        buildWindField();
      };

    map.on(
      "move",
      handleMapMove
    );

    map.on(
      "zoom",
      handleMapMove
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );

      map.off(
        "move",
        handleMapMove
      );

      map.off(
        "zoom",
        handleMapMove
      );

      cancelAnimationFrame(
        animationRef.current
      );

      particlesRef.current =
        [];
    };
  }, [windData]);

  /*
   * ESC KEY
   */
  useEffect(() => {
    const handleKeyDown =
      (event) => {
        if (
          event.key === "Escape"
        ) {
          onClose();
        }
      };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [onClose]);

  /*
   * FLY TO LOCATION
   */
  const handleMyLocation =
    () => {
      if (
        !mapRef.current ||
        !location
      ) {
        return;
      }

      const lat =
        Number(location.latitude);

      const lon =
        Number(location.longitude);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        return;
      }

      mapRef.current.flyTo({
        center: [
          lon,
          lat,
        ],

        zoom: 5,

        duration: 1200,
      });
    };

  return (
    <div className="wind-map-overlay">

      {/* MAP */}
      <div
        ref={mapContainerRef}
        className="wind-map-map"
      />

      {/* WIND CANVAS */}
      <canvas
        ref={canvasRef}
        className="wind-particle-canvas"
      />

      {/* TOP LEFT CARD */}
      <div className="wind-map-brand">

        <div className="wind-brand-icon">
          🌬️
        </div>

        <div>
          <h1>
            Live Wind Map
          </h1>

          <p>
            Global wind movement
          </p>
        </div>

      </div>

      {/* CLOSE */}
      <button
        type="button"
        className="wind-map-close"
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>

      {/* MAP LABELS */}
      <div className="wind-label india-label">
        INDIA
      </div>

      <div className="wind-label arabian-label">
        ARABIAN SEA
      </div>

      <div className="wind-label bengal-label">
        BAY OF BENGAL
      </div>

      <div className="wind-label ocean-label">
        INDIAN OCEAN
      </div>

      {/* LOADING */}
      {loading && (
        <div className="wind-loading">

          <div className="wind-spinner" />

          <strong>
            Loading wind data
          </strong>

          <span>
            Preparing global wind field...
          </span>

        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="wind-error">

          <strong>
            Wind data unavailable
          </strong>

          <span>
            {error}
          </span>

        </div>
      )}

      {/* LEGEND */}
      <div className="wind-legend">

        <div className="wind-legend-row">
          <span className="legend-circle low" />
          <span>
            Low wind
          </span>
        </div>

        <div className="wind-legend-row">
          <span className="legend-circle moderate" />
          <span>
            Moderate
          </span>
        </div>

        <div className="wind-legend-row">
          <span className="legend-circle strong" />
          <span>
            Strong wind
          </span>
        </div>

      </div>

      {/* LOCATION BUTTON */}
      {location && (
        <button
          type="button"
          className="wind-my-location"
          onClick={
            handleMyLocation
          }
        >
          📍 My location
        </button>
      )}

      {/* SOURCE */}
      <div className="wind-source">
        Wind forecast data • WeatherGPT
      </div>

    </div>
  );
}

export default WindMap;