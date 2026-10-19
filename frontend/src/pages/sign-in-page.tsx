import { SignIn, useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";
import { FullPageStatus } from "../components/full-page-status";

export function SignInPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <FullPageStatus label="Memuat autentikasi..." />;
  if (isSignedIn) return <Navigate to="/" replace />;

  return (
    <main className="sign-in-page">
      <div className="sign-in-brand">
        <span className="brand-mark" aria-hidden="true">
          B
        </span>
        <span>Book-in</span>
      </div>
      <p className="sign-in-caption">Sistem Booking Ruang Meeting</p>
      <SignIn routing="hash" />
    </main>
  );
}
