import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./Auth.css";

function Auth() {
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

      } else {
        const {
          data,
          error,
        } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.user && !data.session) {
          setMessage(
            "Account created! Please check your email and verify your account."
          );
        } else {
          setMessage("Account created successfully.");
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);

      setError(
        error.message || "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          🌦️
        </div>

        <h1>WeatherGPT</h1>

        <p className="auth-subtitle">
          AI-powered weather intelligence
        </p>

        <h2>
          {isLogin ? "Welcome back" : "Create your account"}
        </h2>

        <p className="auth-description">
          {isLogin
            ? "Login to continue using WeatherGPT."
            : "Create your free WeatherGPT account."}
        </p>

        <form onSubmit={handleSubmit}>

          <label>Email</label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              isLogin ? "current-password" : "new-password"
            }
            required
          />

          {!isLogin && (
            <>
              <label>Confirm password</label>

              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                required
              />
            </>
          )}

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {message && (
            <div className="auth-success">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isLogin
              ? "Login"
              : "Create account"}
          </button>

        </form>

        <div className="auth-switch">

          {isLogin
            ? "Don't have an account?"
            : "Already have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setMessage("");
            }}
          >
            {isLogin ? "Sign up" : "Login"}
          </button>

        </div>

      </div>
    </main>
  );
}

export default Auth;