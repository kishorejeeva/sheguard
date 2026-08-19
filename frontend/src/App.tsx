import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import SignupForm from "./pages/SignupForm";
import LoginForm from "./pages/LoginForm";
import WearerDashboard from "./pages/WearerDashboard";
import GuardianDashboard from "./pages/GuardianDashboard";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route path="/wearer/signup" element={<SignupForm role="wearer" />} />
          <Route path="/wearer/login" element={<LoginForm role="wearer" />} />
          <Route
            path="/wearer/dashboard"
            element={
              <ProtectedRoute role="WEARER">
                <WearerDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/guardian/signup" element={<SignupForm role="guardian" />} />
          <Route path="/guardian/login" element={<LoginForm role="guardian" />} />
          <Route
            path="/guardian/dashboard"
            element={
              <ProtectedRoute role="GUARDIAN">
                <GuardianDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
