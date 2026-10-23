
import React, { useState } from "react";
import {
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  Landmark,
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  ArrowLeft,
  KeyRound,
} from "lucide-react";

import { auth, googleProvider } from "../firebase";
import { api, type Customer } from "../services/api";

interface AuthScreenProps {
  initialRegister?: boolean;
  onLoginSuccess: (customer: Customer) => void;
  onBackToLanding?: () => void;
  onToast: (msg: string) => void;
}

interface AuthChallengeResponse {
  success: boolean;
  requiresTwoFactor: true;
  challengeId: string;
  expiresIn: number;
  maskedEmail?: string;
  message?: string;
}

interface AuthSuccessResponse {
  success: boolean;
  requiresTwoFactor?: false;
  expiresIn: number;
  customer: Customer;
}

type AuthResponse = AuthChallengeResponse | AuthSuccessResponse;

const isChallenge = (
  response: AuthResponse
): response is AuthChallengeResponse =>
  response.requiresTwoFactor === true &&
  Boolean(response.challengeId);

const isAuthSuccess = (
  response: AuthResponse
): response is AuthSuccessResponse =>
  response.success === true &&
  response.requiresTwoFactor !== true &&
  Boolean(response.customer);

const AuthScreen: React.FC<AuthScreenProps> = ({
  initialRegister = false,
  onLoginSuccess,
  onBackToLanding,
  onToast,
}) => {
  const [isRegister, setIsRegister] = useState(initialRegister);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const role = "customer";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Two-factor authentication state
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpExpiresIn, setOtpExpiresIn] = useState<number | null>(null);
  const [authMethod, setAuthMethod] = useState<"email" | "google">("email");

  // ---------------------------------------------------------
  // COMMON AUTH RESPONSE HANDLER
  // ---------------------------------------------------------
  const handleAuthResponse = (
    response: AuthResponse,
    method: "email" | "google"
  ) => {
    if (!response.success) {
      throw new Error("Authentication was unsuccessful. Please try again.");
    }

    if (isChallenge(response)) {
      setChallengeId(response.challengeId);
      setMaskedEmail(response.maskedEmail || email.trim().toLowerCase());
      setOtpExpiresIn(response.expiresIn ?? null);
      setOtp("");
      setAuthMethod(method);
      setOtpStep(true);
      setError("");

      onToast(
        response.message ||
          "A verification code has been sent to your registered email."
      );
      return;
    }

    if (isAuthSuccess(response)) {
      onToast(`Welcome to VaultBank, ${response.customer.name}!`);
      onLoginSuccess(response.customer);
      return;
    }

    throw new Error("The server returned an unexpected authentication response.");
  };

  // ---------------------------------------------------------
  // EMAIL AND PASSWORD LOGIN
  // ---------------------------------------------------------
  const handleLogin = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await api.login(normalizedEmail, password);

      handleAuthResponse(response as AuthResponse, "email");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // CUSTOMER REGISTRATION
  // ---------------------------------------------------------
  const handleRegister = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!name.trim()) {
      setError("Please enter your full legal name.");
      return;
    }

    if (password.length < 6) {
      setError("Your password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.register({
        name: name.trim(),
        email: normalizedEmail,
        password,
        confirmPassword,
        phone: phone.trim(),
        address: address.trim(),
        role,
      });

      // Login may return an OTP challenge rather than a JWT.
      const response = await api.login(normalizedEmail, password);

      handleAuthResponse(response as AuthResponse, "email");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // GOOGLE SIGN-IN
  // ---------------------------------------------------------
  const handleGoogleSignIn = async () => {
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseIdToken = await result.user.getIdToken();

      if (!firebaseIdToken) {
        throw new Error(
          "Firebase did not return an authentication token."
        );
      }

      // Backend may require email OTP before issuing the VaultBank JWT.
      const response = await api.googleLogin(firebaseIdToken);

      handleAuthResponse(response as AuthResponse, "google");
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" &&
        err !== null &&
        "code" in err
          ? String(err.code)
          : "";

      if (errorCode === "auth/popup-closed-by-user") {
        setError("Google sign-in was cancelled.");
      } else if (errorCode === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized in Firebase Authentication. Add localhost to your Firebase Authorized domains."
        );
      } else if (errorCode === "auth/popup-blocked") {
        setError(
          "Your browser blocked the Google sign-in popup. Allow popups and try again."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Google sign-in failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // VERIFY EMAIL OTP
  // ---------------------------------------------------------
  const handleVerifyOtp = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) return;

    if (!challengeId) {
      setError("Your verification session is missing. Please sign in again.");
      return;
    }

    const normalizedOtp = otp.trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await api.verifyLoginOtp(challengeId, normalizedOtp);

      if (!response.success || !response.customer) {
        throw new Error("Verification failed. Please check your code and try again.");
      }

      // The backend sets its HTTP-only authentication cookie after OTP succeeds.
      setOtpStep(false);
      setChallengeId("");
      setOtp("");
      onToast(`Welcome to VaultBank, ${response.customer.name}!`);
      onLoginSuccess(response.customer);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not verify the code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // RETURN TO SIGN-IN FROM OTP
  // ---------------------------------------------------------
  const cancelOtp = () => {
    if (loading) return;

    setOtpStep(false);
    setOtp("");
    setChallengeId("");
    setMaskedEmail("");
    setOtpExpiresIn(null);
    setError("");
    setPassword("");
  };

  // ---------------------------------------------------------
  // PASSWORD RESET
  // ---------------------------------------------------------
  const handleForgotPassword = async () => {
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(
        "Enter your email address before requesting a password reset."
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);

      onToast(
        "If this email has a Firebase account, a password reset email will be sent."
      );
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" &&
        err !== null &&
        "code" in err
          ? String(err.code)
          : "";

      if (errorCode === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (errorCode === "auth/unauthorized-domain") {
        setError("This domain is not authorized in Firebase Authentication.");
      } else if (errorCode === "auth/too-many-requests") {
        setError("Too many attempts. Please wait before trying again.");
      } else {
        setError(
          "Could not request the reset email. Check your Firebase Authentication settings and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // SWITCH BETWEEN LOGIN AND REGISTRATION
  // ---------------------------------------------------------
  const switchMode = (register: boolean) => {
    if (loading) return;

    setIsRegister(register);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="auth-wrapper">
      {/* LEFT HERO SECTION */}
      <div className="auth-split-left">
        <div className="auth-brand">
          <div className="brand-icon">
            <Landmark size={22} />
          </div>
          <span>VaultBank</span>
        </div>

        <div className="auth-hero-text">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            <Sparkles size={14} />
            Next-Generation Core Banking Platform
          </div>

          <h1>
            Engineered for <br />
            Absolute Financial <br />
            Integrity.
          </h1>

          <p>
            Seamlessly manage accounts, fund transfers, loan facilities,
            and fixed deposits with a secure, modern banking experience.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            color: "var(--text-faint)",
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Shield size={14} className="text-emerald" />
            Secure Authentication
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle size={14} className="text-emerald" />
            Protected Banking APIs
          </div>
        </div>
      </div>

      {/* RIGHT AUTHENTICATION SECTION */}
      <div className="auth-split-right">
        <div className="auth-card">
          {onBackToLanding && !otpStep && (
            <button
              type="button"
              onClick={onBackToLanding}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text-muted)",
                fontSize: 12.5,
                fontWeight: 600,
                marginBottom: 16,
                cursor: "pointer",
              }}
            >
              <ArrowLeft size={14} />
              Back to VaultBank Homepage
            </button>
          )}

          {otpStep ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 14,
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "var(--emerald)",
                    marginBottom: 16,
                  }}
                >
                  <KeyRound size={23} />
                </div>

                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    letterSpacing: -0.5,
                  }}
                >
                  Verify Your Identity
                </h2>

                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    marginTop: 8,
                    lineHeight: 1.6,
                  }}
                >
                  Enter the 6-digit code sent to{" "}
                  <strong>{maskedEmail || "your registered email"}</strong>.
                  {otpExpiresIn !== null && (
                    <> The code expires in {Math.ceil(otpExpiresIn / 60)} minute(s).</>
                  )}
                </p>

                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-faint)",
                    marginTop: 8,
                  }}
                >
                  Verification method: {authMethod === "google" ? "Google sign-in" : "Email and password"}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "var(--rose)",
                    padding: 12,
                    borderRadius: 8,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 18,
                    overflowWrap: "anywhere",
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <label className="form-label" htmlFor="login-otp">
                    <KeyRound
                      size={14}
                      style={{ display: "inline", marginRight: 6 }}
                    />
                    Verification Code
                  </label>

                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    maxLength={6}
                    pattern="[0-9]{6}"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? "Verifying Code..." : "Verify and Continue"}
                </button>

                <button
                  type="button"
                  onClick={cancelOtp}
                  disabled={loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    width: "100%",
                    marginTop: 16,
                    color: "var(--text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <ArrowLeft size={14} />
                  Return to Sign In
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    letterSpacing: -0.5,
                  }}
                >
                  {isRegister ? "Create Customer Account" : "Access VaultBank Portal"}
                </h2>

                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  {isRegister
                    ? "Enter your details to register for VaultBank."
                    : "Sign in with your VaultBank credentials."}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "var(--rose)",
                    padding: 12,
                    borderRadius: 8,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 18,
                    overflowWrap: "anywhere",
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error}</span>
                </div>
              )}

              {isRegister ? (
                <form onSubmit={handleRegister}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="register-name">
                      <User size={14} style={{ display: "inline", marginRight: 6 }} />
                      Full Legal Name
                    </label>
                    <input
                      id="register-name"
                      type="text"
                      placeholder="Enter your full name"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="register-email">
                      <Mail size={14} style={{ display: "inline", marginRight: 6 }} />
                      Email Address
                    </label>
                    <input
                      id="register-email"
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div className="form-group">
                      <label className="form-label" htmlFor="register-phone">
                        <Phone size={14} style={{ display: "inline", marginRight: 6 }} />
                        Phone Number
                      </label>
                      <input
                        id="register-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        disabled={loading}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="register-role">
                        Account Role
                      </label>
                      <input
                        id="register-role"
                        type="text"
                        value="Customer"
                        readOnly
                        disabled
                        aria-describedby="role-help"
                      />
                      <small
                        id="role-help"
                        style={{
                          display: "block",
                          marginTop: 5,
                          color: "var(--text-faint)",
                          fontSize: 11,
                        }}
                      >
                        Staff and admin access requires authorization.
                      </small>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="register-address">
                      <MapPin size={14} style={{ display: "inline", marginRight: 6 }} />
                      Address
                    </label>
                    <input
                      id="register-address"
                      type="text"
                      placeholder="City, State"
                      autoComplete="street-address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div className="form-group">
                      <label className="form-label" htmlFor="register-password">
                        <Lock size={14} style={{ display: "inline", marginRight: 6 }} />
                        Password
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Minimum 6 characters"
                          autoComplete="new-password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          minLength={6}
                          disabled={loading}
                          style={{ paddingRight: 42 }}
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={loading}
                          style={{
                            position: "absolute",
                            right: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--text-faint)",
                          }}
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="register-confirm-password">
                        Confirm Password
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          id="register-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Repeat password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          required
                          disabled={loading}
                          style={{ paddingRight: 42 }}
                        />
                        <button
                          type="button"
                          aria-label={
                            showConfirmPassword
                              ? "Hide confirm password"
                              : "Show confirm password"
                          }
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          disabled={loading}
                          style={{
                            position: "absolute",
                            right: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--text-faint)",
                          }}
                        >
                          {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", marginTop: 10 }}
                    disabled={loading}
                  >
                    {loading ? "Creating Customer Account..." : "Complete Registration"}
                  </button>

                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 18,
                      fontSize: 13,
                      color: "var(--text-muted)",
                    }}
                  >
                    Already have an account?{" "}
                    <button
                      type="button"
                      style={{ color: "var(--emerald)", fontWeight: 700 }}
                      disabled={loading}
                      onClick={() => switchMode(false)}
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-email">
                      <Mail size={14} style={{ display: "inline", marginRight: 6 }} />
                      Email Address
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <label className="form-label" htmlFor="login-password">
                        <Lock size={14} style={{ display: "inline", marginRight: 6 }} />
                        Security Password
                      </label>

                      <button
                        type="button"
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-faint)",
                          whiteSpace: "nowrap",
                        }}
                        disabled={loading}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>

                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      disabled={loading}
                    />

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--emerald)",
                        }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", marginTop: 12 }}
                    disabled={loading}
                  >
                    {loading ? "Authenticating Vault..." : "Sign In to VaultBank"}
                  </button>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "20px 0",
                      color: "var(--text-faint)",
                      fontSize: 11,
                    }}
                  >
                    <span style={{ height: 1, flex: 1, background: "var(--border-color)" }} />
                    OR CONTINUE WITH
                    <span style={{ height: 1, flex: 1, background: "var(--border-color)" }} />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      width: "100%",
                      padding: "12px 16px",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                      background: "transparent",
                      color: "var(--text-main)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#4285F4",
                        lineHeight: 1,
                      }}
                    >
                      G
                    </span>
                    {loading ? "Please wait..." : "Continue with Google"}
                  </button>

                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 18,
                      fontSize: 13,
                      color: "var(--text-muted)",
                    }}
                  >
                    Don't have an account yet?{" "}
                    <button
                      type="button"
                      style={{ color: "var(--emerald)", fontWeight: 700 }}
                      disabled={loading}
                      onClick={() => switchMode(true)}
                    >
                      Register Account
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
