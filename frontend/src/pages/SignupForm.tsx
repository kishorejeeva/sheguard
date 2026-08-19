import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function SignupForm({ role }: { role: "wearer" | "guardian" }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    whatsappNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [locationGranted, setLocationGranted] = useState(false);
  const [bluetoothAvailable] = useState(typeof navigator !== "undefined" && "bluetooth" in navigator);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestLocation() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      () => setLocationGranted(true),
      () => setLocationGranted(false)
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post(`/auth/${role}/signup`, form);
      login(data.token, data.user);
      navigate(`/${role}/dashboard`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-navy mb-1">
          {role === "wearer" ? "Wearer Signup" : "Guardian Signup"}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {role === "wearer"
            ? "Set up your SheGuard safety profile."
            : "Join as a guardian to help protect people nearby."}
        </p>

        {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Phone Number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" />
          <Field
            label="WhatsApp Number"
            value={form.whatsappNumber}
            onChange={(v) => setForm({ ...form, whatsappNumber: v })}
            type="tel"
          />
          <Field
            label="Create Password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            type="password"
          />
          <Field
            label="Re-enter Password"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
            type="password"
          />

          {role === "wearer" && (
            <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase">Required permissions</p>
              <div className="flex items-center justify-between text-sm">
                <span>Location — used to send your position during an emergency.</span>
                <button
                  type="button"
                  onClick={requestLocation}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    locationGranted ? "bg-green-100 text-green-700" : "bg-slate-200"
                  }`}
                >
                  {locationGranted ? "✓ Allowed" : "Allow"}
                </button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Bluetooth — used to connect your SheGuard device.</span>
                <span className={`text-xs font-medium ${bluetoothAvailable ? "text-green-700" : "text-amber-600"}`}>
                  {bluetoothAvailable ? "Supported" : "Not supported on this browser"}
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-violet text-white font-semibold disabled:opacity-60"
          >
            {loading ? "Signing up..." : "Create Account"}
          </button>
        </form>

        <p className="mt-5 text-sm text-center text-slate-500">
          Already have an account?{" "}
          <Link to={`/${role}/login`} className="text-violet font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet"
      />
    </label>
  );
}
