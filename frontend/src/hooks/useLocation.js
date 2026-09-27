import { useState } from "react";

export function useLocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLoading(false);
      },
      (error) => {
        setLoading(false);

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError("Location permission was denied.");
            break;

          case error.POSITION_UNAVAILABLE:
            setError("Location information is unavailable.");
            break;

          case error.TIMEOUT:
            setError("Location request timed out.");
            break;

          default:
            setError("Unable to get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  return {
    location,
    error,
    loading,
    requestLocation,
  };
}