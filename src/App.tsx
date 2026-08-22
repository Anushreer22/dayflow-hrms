import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type AuthState =
  | "loading"
  | "login"
  | "forgotPassword"
  | "resendVerification"
  | "resetPassword"
  | "changePassword"
  | "authenticated";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string>("");
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [resendEmail, setResendEmail] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        if (isRecovery) {
          setAuthState("resetPassword");
          // Clean the URL to avoid re-triggering
          window.history.replaceState(null, "", window.location.pathname);
        } else {
          checkUser(session.user.id);
        }
      } else {
        setAuthState("login");
      }
    });
  }, []);

  async function checkUser(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select("must_change_password, role")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user:", error);
      setError("Could not fetch user details. Please contact admin.");
      setAuthState("login");
      return;
    }

    setRole(data.role);
    setMustChangePassword(data.must_change_password);
    setAuthState(data.must_change_password ? "changePassword" : "authenticated");
  }

  async function handleLogin() {
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSession(data.session);
    await checkUser(data.session.user.id);
    setLoading(false);
  }

  async function handleForgotPassword() {
    setError("");
    setSuccess("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
      redirectTo: "http://localhost:5173/",
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password reset email sent. Check your inbox.");
    }
    setLoading(false);
  }

  async function handleResendVerification() {
    setError("");
    setSuccess("");
    setLoading(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: resendEmail,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Verification email resent. Check your inbox.");
    }
    setLoading(false);
  }

  async function handleResetPassword() {
    setError("");
    setSuccess("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setAuthState("login");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("Password reset successfully. Please sign in with your new password.");
    setLoading(false);
  }

  async function handlePasswordChange() {
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const { error: dbError } = await supabase
      .from("users")
      .update({ must_change_password: false })
      .eq("id", session.user.id);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    setMustChangePassword(false);
    setAuthState("authenticated");
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setAuthState("login");
    setLoginEmail("");
    setLoginPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  }

  // ================= RENDER =================

  if (authState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p>Loading…</p>
      </main>
    );
  }

  if (authState === "login") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
          <h1 className="text-xl font-semibold">Sign in to Dayflow</h1>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Email"
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Password"
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
          />
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <div className="flex flex-col gap-1 text-sm">
            <button
              type="button"
              className="text-left text-blue-600 hover:underline"
              onClick={() => {
                setAuthState("forgotPassword");
                setError("");
                setSuccess("");
              }}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="text-left text-blue-600 hover:underline"
              onClick={() => {
                setAuthState("resendVerification");
                setError("");
                setSuccess("");
              }}
            >
              Resend verification email
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (authState === "forgotPassword") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
          <h1 className="text-xl font-semibold">Reset password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your account email to receive a password reset link.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Email"
            type="email"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
          />
          <Button className="w-full" onClick={handleForgotPassword} disabled={loading}>
            {loading ? "Sending…" : "Send reset email"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setAuthState("login");
              setError("");
              setSuccess("");
            }}
          >
            Back to sign in
          </Button>
        </div>
      </main>
    );
  }

  if (authState === "resendVerification") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
          <h1 className="text-xl font-semibold">Resend verification email</h1>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Email"
            type="email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
          />
          <Button className="w-full" onClick={handleResendVerification} disabled={loading}>
            {loading ? "Sending…" : "Resend verification"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setAuthState("login");
              setError("");
              setSuccess("");
            }}
          >
            Back to sign in
          </Button>
        </div>
      </main>
    );
  }

  if (authState === "resetPassword") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
          <h1 className="text-xl font-semibold">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button className="w-full" onClick={handleResetPassword} disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </div>
      </main>
    );
  }

  if (authState === "changePassword") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
          <h1 className="text-xl font-semibold">Change your password</h1>
          <p className="text-sm text-muted-foreground">
            You must set a new password before continuing.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button className="w-full" onClick={handlePasswordChange} disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </Button>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-2xl font-semibold">Welcome to Dayflow</h1>
      <p>
        You are signed in as <span className="font-medium">{session?.user?.email}</span>.
      </p>
      <p className="text-sm text-muted-foreground">
        Role: {role} | Password change required: {mustChangePassword ? "Yes" : "No"}
      </p>
      <Button variant="outline" onClick={handleLogout}>
        Log out
      </Button>
    </main>
  );
}