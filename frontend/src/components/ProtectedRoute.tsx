import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({
  role,
  children,
}: {
  role: "WEARER" | "GUARDIAN";
  children: React.ReactNode;
}) {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to={role === "WEARER" ? "/wearer/login" : "/guardian/login"} replace />;
  }
  if (user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
