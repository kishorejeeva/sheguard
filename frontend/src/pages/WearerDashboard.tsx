import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useAuth } from "../contexts/AuthContext";
import { api, apiErrorMessage } from "../services/api";
import { getSocket } from "../services/socket";
import { useGeolocation } from "../hooks/useGeolocation";
import { bluetoothService, isBluetoothSupported, BluetoothState } from "../services/bluetoothService";

interface Contact {
  id: string;
  name: string;
  phone: string;
  whatsappNumber: string;
  relationship: string;
}

const LANGUAGES = ["English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada"];

export default function WearerDashboard() {
  const { user, logout } = useAuth();
  const geo = useGeolocation();

  const [btState, setBtState] = useState<BluetoothState>(isBluetoothSupported() ? "idle" : "unsupported");
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState({ name: "", phone: "", whatsappNumber: "", relationship: "" });
  const [contactError, setContactError] = useState("");

  const [language, setLanguage] = useState("English");
  const [keyword, setKeyword] = useState("help me");
  const [detectionCount, setDetectionCount] = useState(0);

  const [alertId, setAlertId] = useState<string | null>(null);
  const [alertStatus, setAlertStatus] = useState<"idle" | "countdown" | "escalated" | "active" | "stopped">("idle");
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [banner, setBanner] = useState("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadContacts();
    loadVoiceSettings();
    geo.getCurrentPosition().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on("alert:escalated", () => {
      setAlertStatus("escalated");
      setBanner("Alert not stopped in time — escalating to your contacts, police, and nearby guardians.");
    });
    socket.on("alert:active", () => {
      setAlertStatus("active");
      setBanner("Emergency alert sent. Your contacts and nearby guardians have been notified.");
    });
    socket.on("alert:stopped", () => {
      setAlertStatus("stopped");
      stopCountdownTimer();
      setBanner("Emergency alert cancelled.");
    });

    return () => {
      socket.off("alert:escalated");
      socket.off("alert:active");
      socket.off("alert:stopped");
    };
  }, []);

  async function loadContacts() {
    try {
      const { data } = await api.get("/wearer/contacts");
      setContacts(data.contacts);
    } catch {
      /* non-fatal */
    }
  }

  async function loadVoiceSettings() {
    try {
      const { data } = await api.get("/wearer/voice-settings");
      setLanguage(data.settings.language || "English");
      setKeyword(data.settings.keyword || "help me");
      setDetectionCount(data.settings.detectionCount || 0);
    } catch {
      /* non-fatal */
    }
  }

  async function saveVoiceSettings(next: { language?: string; keyword?: string }) {
    try {
      await api.put("/wearer/voice-settings", next);
    } catch {
      /* non-fatal */
    }
  }

  async function addContact() {
    setContactError("");
    if (contacts.length >= 5) {
      setContactError("You can add a maximum of 5 emergency contacts.");
      return;
    }
    try {
      const { data } = await api.post("/wearer/contacts", newContact);
      setContacts([...contacts, data.contact]);
      setNewContact({ name: "", phone: "", whatsappNumber: "", relationship: "" });
    } catch (err) {
      setContactError(apiErrorMessage(err));
    }
  }

  async function deleteContact(id: string) {
    await api.delete(`/wearer/contacts/${id}`);
    setContacts(contacts.filter((c) => c.id !== id));
  }

  async function connectBluetooth() {
    setBtState("connecting");
    try {
      const info = await bluetoothService.connect(() => {
        setBtState("disconnected");
        setBtDeviceName(null);
      });
      setBtDeviceName(info.name);
      setBtState("connected");
      await api.post("/wearer/device", { deviceName: info.name, deviceIdentifier: info.id });
    } catch (err: any) {
      setBtState(err?.name === "NotFoundError" ? "idle" : "permission-denied");
    }
  }

  async function disconnectBluetooth() {
    bluetoothService.disconnect();
    setBtState("disconnected");
    setBtDeviceName(null);
    await api.delete("/wearer/device");
  }

  function vibrate(pattern: number | number[]) {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  }

  async function triggerSOS() {
    setBanner("");
    try {
      const point = await geo.getCurrentPosition();
      const { data } = await api.post("/wearer/alerts", {
        latitude: point.latitude,
        longitude: point.longitude,
      });
      setAlertId(data.alert.id);
      setAlertStatus("countdown");
      setSecondsLeft(60);
      vibrate([300, 100, 300]);
      if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") new Notification("SheGuard: Emergency alert started");
        });
      }
      startCountdownTimer();
      geo.startWatching((p) => {
        api.post(`/wearer/alerts/${data.alert.id}/location`, p).catch(() => {});
      });
    } catch (err) {
      setBanner(apiErrorMessage(err) || "Unable to start emergency alert. Check location permission.");
    }
  }

  function startCountdownTimer() {
    stopCountdownTimer();
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
  }

  function stopCountdownTimer() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    geo.stopWatching();
  }

  async function cancelSOS() {
    if (!alertId) return;
    try {
      await api.post(`/wearer/alerts/${alertId}/stop`);
      setAlertStatus("stopped");
      stopCountdownTimer();
      setBanner("Emergency alert cancelled.");
    } catch (err) {
      setBanner(apiErrorMessage(err));
    }
  }

  const pos = geo.position;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy text-white px-6 py-4 flex items-center justify-between">
        <div className="font-bold">🛡️ SheGuard</div>
        <div className="flex items-center gap-4 text-sm">
          <span>{user?.name}</span>
          <button onClick={logout} className="px-3 py-1 rounded-lg bg-white/10">
            Logout
          </button>
        </div>
      </header>

      {banner && <div className="bg-amber-50 text-amber-800 border-b border-amber-200 px-6 py-3 text-sm">{banner}</div>}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* SOS */}
        <section className="bg-white rounded-2xl shadow p-6 text-center">
          {alertStatus === "idle" || alertStatus === "stopped" ? (
            <button
              onClick={triggerSOS}
              className="w-40 h-40 mx-auto rounded-full bg-brand-red text-white text-xl font-extrabold shadow-lg active:scale-95 transition"
            >
              SOS
              <div className="text-xs font-medium mt-1">EMERGENCY</div>
            </button>
          ) : (
            <div>
              <div className="text-brand-red font-bold text-lg">EMERGENCY ALERT {alertStatus.toUpperCase()}</div>
              {alertStatus === "countdown" && (
                <>
                  <p className="text-sm text-slate-500 mt-1">Alert will be sent to emergency recipients in:</p>
                  <div className="text-5xl font-mono font-bold my-3">
                    00:{String(secondsLeft).padStart(2, "0")}
                  </div>
                  <button onClick={cancelSOS} className="px-6 py-3 rounded-xl bg-slate-800 text-white font-semibold">
                    STOP ALERT
                  </button>
                </>
              )}
              {(alertStatus === "escalated" || alertStatus === "active") && (
                <p className="text-sm text-slate-600 mt-2">
                  Your emergency contacts, configured police, and nearby guardians are being notified.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Current location map */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">Current Location</h2>
          {geo.supported ? (
            pos ? (
              <div className="h-56 rounded-xl overflow-hidden">
                <MapContainer center={[pos.latitude, pos.longitude]} zoom={15} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                  <Marker position={[pos.latitude, pos.longitude]}>
                    <Popup>You are here</Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Location permission required.</p>
            )
          ) : (
            <p className="text-sm text-amber-600">Location is not supported on this browser/device.</p>
          )}
        </section>

        {/* Bluetooth */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">Bluetooth Device</h2>
          {btState === "unsupported" ? (
            <p className="text-sm text-amber-600">Bluetooth is not supported on this browser/device.</p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Status: <span className="font-medium">{btState === "connected" ? "Connected" : "Not Connected"}</span>
              </p>
              {btDeviceName && <p className="text-sm text-slate-600">Device Name: {btDeviceName}</p>}
              <div className="mt-3 flex gap-3">
                <button
                  onClick={connectBluetooth}
                  disabled={btState === "connecting" || btState === "connected"}
                  className="px-4 py-2 rounded-lg bg-violet text-white text-sm disabled:opacity-50"
                >
                  {btState === "connecting" ? "Connecting..." : "Connect Device"}
                </button>
                <button
                  onClick={disconnectBluetooth}
                  disabled={btState !== "connected"}
                  className="px-4 py-2 rounded-lg bg-slate-200 text-sm disabled:opacity-50"
                >
                  Disconnect Device
                </button>
              </div>
              {btState === "permission-denied" && (
                <p className="text-xs text-red-600 mt-2">Bluetooth permission denied.</p>
              )}
            </>
          )}
        </section>

        {/* Voice detection */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">Voice Detection</h2>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex-1">
              Language
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  saveVoiceSettings({ language: e.target.value });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <label className="flex-1">
              Emergency phrase
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onBlur={() => saveVoiceSettings({ keyword })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Detection Count: <span className="font-semibold">{detectionCount}</span>
          </p>
          {!("webkitSpeechRecognition" in window || "SpeechRecognition" in window) && (
            <p className="text-xs text-amber-600 mt-2">
              Speech recognition is not supported on this browser.
            </p>
          )}
        </section>

        {/* Emergency contacts */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-2">Emergency Contacts ({contacts.length}/5)</h2>
          <div className="space-y-2 mb-4">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-slate-500">{c.phone} · {c.relationship}</div>
                </div>
                <button onClick={() => deleteContact(c.id)} className="text-red-600 text-xs font-medium">
                  Delete
                </button>
              </div>
            ))}
          </div>

          {contacts.length < 5 && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <input
                placeholder="Name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                placeholder="Relationship"
                value={newContact.relationship}
                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                placeholder="Phone"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                placeholder="WhatsApp Number"
                value={newContact.whatsappNumber}
                onChange={(e) => setNewContact({ ...newContact, whatsappNumber: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <button onClick={addContact} className="col-span-2 py-2 rounded-lg bg-violet text-white font-medium">
                Add Contact
              </button>
              {contactError && <p className="col-span-2 text-xs text-red-600">{contactError}</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
