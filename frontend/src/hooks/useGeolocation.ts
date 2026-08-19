import { useCallback, useRef, useState } from "react";

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function useGeolocation() {
  const [supported] = useState(() => typeof navigator !== "undefined" && "geolocation" in navigator);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const getCurrentPosition = useCallback((): Promise<GeoPoint> => {
    return new Promise((resolve, reject) => {
      if (!supported) {
        const msg = "Location is not supported on this browser/device.";
        setError(msg);
        return reject(new Error(msg));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const point = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setPermission("granted");
          setPosition(point);
          resolve(point);
        },
        (err) => {
          setPermission(err.code === err.PERMISSION_DENIED ? "denied" : "unknown");
          setError("Unable to get current location.");
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }, [supported]);

  const startWatching = useCallback(
    (onUpdate: (point: GeoPoint) => void) => {
      if (!supported || watchId.current !== null) return;
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const point = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setPosition(point);
          onUpdate(point);
        },
        (err) => setError(err.message),
        { enableHighAccuracy: true }
      );
    },
    [supported]
  );

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  return { supported, permission, position, error, getCurrentPosition, startWatching, stopWatching };
}
