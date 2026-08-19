import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { useGeolocation } from "../hooks/useGeolocation";

interface NearbyAlert {
  alertId: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  address?: string;
  message: string;
  createdAt: string;
  status?: string;
}

export default function GuardianDashboard() {
  const { user, logout } = useAuth();
  const geo = useGeolocation();
  const [shareEnabled, setShareEnabled] = useState(false);
  const [activeAlert, setActiveAlert] = useState<NearbyAlert | null>(null);

  useEffect(() => {
    loadNearbyAlerts();

    const socket = getSocket();
    if (!socket) return;

    socket.on("guardian:nearby-alert", (payload: NearbyAlert) => {
      setActiveAlert({ ...payload, status: "ACTIVE" });
      if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("🚨 SheGuard Emergency Alert", {
          body: `A safety alert has been triggered within ${payload.distanceKm.toFixed(1)} KM.`,
        });
      }
      socket.emit("alert:subscribe", payload.alertId);
    });

    socket.on("alert:location-update", (payload: { alertId: string; latitude: number; longitude: number }) => {
      setActiveAlert((prev) => (prev && prev.alertId === payload.alertId ? { ...prev, ...payload } : prev));
    });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      socket.off("guardian:nearby-alert");
      socket.off("alert:location-update");
    };
  }, []);

  async function loadNearbyAlerts() {
    try {
      const { data } = await api.get("/guardian/alerts/nearby");
      if (data.alerts?.length > 0) {
        const a = data.alerts[0];
        setActiveAlert({
          alertId: a.id,
          distanceKm: 0,
          latitude: a.latitude,
          longitude: a.longitude,
          address: a.address,
          message: a.message,
          createdAt: a.createdAt,
          status: a.status,
        });
      }
    } catch {
      /* non-fatal */
    }
  }

  async function toggleSharing() {
    const next = !shareEnabled;
    setShareEnabled(next);
    if (!geo.supported) return;

    if (next) {
      const point = await geo.getCurrentPosition().catch(() => null);
      if (point) {
        await api.post("/guardian/location", { ...point, active: true });
        geo.startWatching((p) => {
          api.post("/guardian/location", { ...p, active: true }).catch(() => {});
        });
      }
    } else {
      geo.stopWatching();
      await api.post("/guardian/location", {
        latitude: geo.position?.latitude || 0,
        longitude: geo.position?.longitude || 0,
        active: false,
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy text-white px-6 py-4 flex items-center justify-between">
        <div className="font-bold">🛡️ SheGuard — Guardian</div>
        <div className="flex items-center gap-4 text-sm">
          <span>{user?.name}</span>
          <button onClick={logout} className="px-3 py-1 rounded-lg bg-white/10">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-2xl shadow p-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Nearby Community Protection</h2>
            <p className="text-sm text-slate-500">
              Share your location to be alerted when someone nearby needs help (within 5 KM).
            </p>
          </div>
          <button
            onClick={toggleSharing}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              shareEnabled ? "bg-green-100 text-green-700" : "bg-slate-200"
            }`}
          >
            {shareEnabled ? "Sharing ON" : "Sharing OFF"}
          </button>
        </section>

        {!activeAlert ? (
          <section className="bg-white rounded-2xl shadow p-10 text-center text-slate-500">
            No active emergency alerts nearby.
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="bg-brand-red text-white px-4 py-3 font-bold">🚨 EMERGENCY ALERT</div>
            <div className="p-4 space-y-3">
              <p className="text-sm">
                Distance: <span className="font-semibold">{activeAlert.distanceKm.toFixed(1)} KM</span>
              </p>
              <div className="h-56 rounded-xl overflow-hidden">
                <MapContainer
                  center={[activeAlert.latitude, activeAlert.longitude]}
                  zoom={15}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                  <Marker position={[activeAlert.latitude, activeAlert.longitude]}>
                    <Popup>Wearer's live location</Popup>
                  </Marker>
                </MapContainer>
              </div>
              <p className="text-sm text-slate-600">
                Live Address: {activeAlert.address || `${activeAlert.latitude.toFixed(5)}, ${activeAlert.longitude.toFixed(5)}`}
              </p>
              <p className="text-sm text-slate-600">{activeAlert.message}</p>
              <p className="text-xs font-semibold text-brand-red uppercase">Status: {activeAlert.status}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
