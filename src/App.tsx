import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusBadgeClass } from "@/lib/status";

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
  const [sessionExpired, setSessionExpired] = useState(false);

  // Employee attendance states
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [checkInMessage, setCheckInMessage] = useState("");
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [checkOutError, setCheckOutError] = useState("");
  const [checkOutMessage, setCheckOutMessage] = useState("");
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [attendanceListLoading, setAttendanceListLoading] = useState(false);
  const [attendanceListError, setAttendanceListError] = useState("");

  // Admin attendance states
  const [adminTodayList, setAdminTodayList] = useState<any[]>([]);
  const [adminMonthSummary, setAdminMonthSummary] = useState<any>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  const manualLogoutRef = useRef(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        if (isRecovery) {
          setAuthState("resetPassword");
          window.history.replaceState(null, "", window.location.pathname);
        } else {
          checkUser(session.user.id);
        }
      } else {
        setAuthState("login");
      }
    });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setSession(null);
          setAuthState("login");
          setLoginPassword("");
          setNewPassword("");
          setConfirmPassword("");

          if (!manualLogoutRef.current) {
            setSessionExpired(true);
          }
          manualLogoutRef.current = false;
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          if (session) {
            setSession(session);
          }
        }

        if (event === "SIGNED_IN") {
          setSession(session);
          if (session) {
            checkUser(session.user.id);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load today's attendance for current user (any role)
  useEffect(() => {
    if (authState === "authenticated" && session) {
      loadTodayAttendance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, session]);

  // Load employee monthly attendance list (only for employees)
  useEffect(() => {
    if (authState === "authenticated" && session && role === "employee") {
      loadAttendanceList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, session, role, attendanceMonth]);

  // Load admin attendance data (only for admins)
  useEffect(() => {
    if (authState === "authenticated" && session && role === "admin") {
      loadAdminData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, session, role]);

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
    setSuccess("");
    setSessionExpired(false);
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
    manualLogoutRef.current = true;
    setSessionExpired(false);
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

  // ===== Employee Attendance Helpers =====

  function getLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function loadTodayAttendance() {
    if (!session) return;
    const localDate = getLocalDateString();
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("date", localDate)
      .maybeSingle();

    if (!error) {
      setTodayAttendance(data);
    }
  }

  async function handleCheckIn() {
    if (!session) return;
    setCheckInLoading(true);
    setCheckInError("");
    setCheckInMessage("");

    const localDate = getLocalDateString();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("attendance")
      .insert([
        {
          user_id: session.user.id,
          date: localDate,
          check_in: now,
          status: "present",
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        setCheckInError("You have already checked in today.");
      } else {
        setCheckInError(error.message);
      }
    } else {
      setCheckInMessage("Checked in successfully.");
      setTodayAttendance(data);
      if (role === "employee") loadAttendanceList();
      if (role === "admin") loadAdminData();
    }
    setCheckInLoading(false);
  }

  async function handleCheckOut() {
    if (!session || !todayAttendance || todayAttendance.check_out) return;
    setCheckOutLoading(true);
    setCheckOutError("");
    setCheckOutMessage("");

    const now = new Date().toISOString();
    const checkInTime = new Date(todayAttendance.check_in).getTime();
    const checkOutTime = new Date(now).getTime();
    const diffMs = checkOutTime - checkInTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    const workHours = Math.max(0, diffHours);
    const standardHours = 8;
    const extraHours = Math.max(0, workHours - standardHours);

    const { data, error } = await supabase
      .from("attendance")
      .update({
        check_out: now,
        work_hours: workHours,
        extra_hours: extraHours,
      })
      .eq("id", todayAttendance.id)
      .select()
      .single();

    if (error) {
      setCheckOutError(error.message);
    } else {
      setCheckOutMessage("Checked out successfully.");
      setTodayAttendance(data);
      if (role === "employee") loadAttendanceList();
      if (role === "admin") loadAdminData();
    }
    setCheckOutLoading(false);
  }

  function getMonthStartEnd(month: string) {
    const [year, mon] = month.split("-").map(Number);
    const start = `${year}-${String(mon).padStart(2, "0")}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const end = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }

  async function loadAttendanceList() {
    if (!session) return;
    setAttendanceListLoading(true);
    setAttendanceListError("");

    const { start, end } = getMonthStartEnd(attendanceMonth);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", session.user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false });

    if (error) {
      setAttendanceListError(error.message);
    } else {
      setAttendanceList(data || []);
    }
    setAttendanceListLoading(false);
  }

  function changeMonth(delta: number) {
    const [year, mon] = attendanceMonth.split("-").map(Number);
    const d = new Date(year, mon - 1 + delta, 1);
    setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // ===== Admin Attendance Helpers =====

  async function loadAdminData() {
    if (!session) return;
    setAdminLoading(true);
    setAdminError("");

    const today = getLocalDateString();

    // Fetch today's attendance with user + profile, using explicit FK for profiles
    const { data: todayData, error: todayError } = await supabase
      .from("attendance")
      .select(`
        id,
        date,
        check_in,
        check_out,
        work_hours,
        extra_hours,
        status,
        users!inner (
          id,
          login_id,
          email,
          profiles!profiles_user_id_fkey (full_name)
        )
      `)
      .eq("date", today);

    if (todayError) {
      setAdminError(todayError.message);
      setAdminLoading(false);
      return;
    }

    setAdminTodayList(todayData || []);

    // Fetch monthly summary counts
    const { start, end } = getMonthStartEnd(attendanceMonth);
    const { data: monthData, error: monthError } = await supabase
      .from("attendance")
      .select("status")
      .gte("date", start)
      .lte("date", end);

    if (monthError) {
      setAdminError(monthError.message);
      setAdminLoading(false);
      return;
    }

    const summary: Record<string, number> = {};
    (monthData || []).forEach((row: any) => {
      const s = row.status;
      summary[s] = (summary[s] || 0) + 1;
    });
    setAdminMonthSummary(summary);
    setAdminLoading(false);
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
          {sessionExpired && (
            <p className="text-sm rounded bg-yellow-100 p-2 text-yellow-800">
              Your session has expired. Please sign in again.
            </p>
          )}
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

  // Authenticated view
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-foreground p-6">
      <h1 className="text-2xl font-semibold">Welcome to Dayflow</h1>
      <p>
        You are signed in as <span className="font-medium">{session?.user?.email}</span>.
      </p>
      <p className="text-sm text-muted-foreground">
        Role: {role} | Password change required: {mustChangePassword ? "Yes" : "No"}
      </p>

      <div className="w-full max-w-2xl space-y-4">
        {/* Attendance card (current user check-in/out) */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">My Attendance Today</h2>
          {!todayAttendance ? (
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={handleCheckIn}
                disabled={checkInLoading}
              >
                {checkInLoading ? "Checking in…" : "Check In"}
              </Button>
              {checkInError && <p className="text-sm text-red-500">{checkInError}</p>}
              {checkInMessage && <p className="text-sm text-green-600">{checkInMessage}</p>}
            </div>
          ) : todayAttendance.check_out ? (
            <div className="space-y-2">
              <p className="text-sm">
                Status: <span className="font-medium">Present</span>
              </p>
              <p className="text-sm">
                Check-in:{" "}
                <span className="font-medium">
                  {new Date(todayAttendance.check_in).toLocaleTimeString()}
                </span>
              </p>
              <p className="text-sm">
                Check-out:{" "}
                <span className="font-medium">
                  {new Date(todayAttendance.check_out).toLocaleTimeString()}
                </span>
              </p>
              <p className="text-sm">
                Work hours:{" "}
                <span className="font-medium">
                  {todayAttendance.work_hours?.toFixed(2) ?? "—"}
                </span>
              </p>
              <p className="text-sm">
                Extra hours:{" "}
                <span className="font-medium">
                  {todayAttendance.extra_hours?.toFixed(2) ?? "—"}
                </span>
              </p>
              <Button disabled className="w-full">
                Checked out
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Status: <span className="font-medium">Present</span>
              </p>
              <p className="text-sm">
                Check-in:{" "}
                <span className="font-medium">
                  {new Date(todayAttendance.check_in).toLocaleTimeString()}
                </span>
              </p>
              <Button
                className="w-full"
                onClick={handleCheckOut}
                disabled={checkOutLoading}
              >
                {checkOutLoading ? "Checking out…" : "Check Out"}
              </Button>
              {checkOutError && <p className="text-sm text-red-500">{checkOutError}</p>}
              {checkOutMessage && <p className="text-sm text-green-600">{checkOutMessage}</p>}
            </div>
          )}
        </Card>

        {/* Employee monthly attendance list */}
        {role === "employee" && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Monthly Attendance</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}>
                  ←
                </Button>
                <span className="text-sm font-medium">{attendanceMonth}</span>
                <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>
                  →
                </Button>
              </div>
            </div>

            {attendanceListLoading ? (
              <p className="text-sm text-muted-foreground">Loading attendance…</p>
            ) : attendanceListError ? (
              <p className="text-sm text-red-500">{attendanceListError}</p>
            ) : attendanceList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records for this month.</p>
            ) : (
              <div className="space-y-2">
                {attendanceList.map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded border p-2">
                    <div>
                      <p className="text-sm font-medium">{record.date}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.check_in
                          ? `In: ${new Date(record.check_in).toLocaleTimeString()}`
                          : "No check-in"}
                        {record.check_out
                          ? ` · Out: ${new Date(record.check_out).toLocaleTimeString()}`
                          : " · No check-out"}
                      </p>
                    </div>
                    <Badge className={getStatusBadgeClass(record.status)}>
                      {record.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Admin attendance view */}
        {role === "admin" && (
          <>
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Today's Attendance (All Employees)</h2>
              {adminLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : adminError ? (
                <p className="text-sm text-red-500">{adminError}</p>
              ) : adminTodayList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance records yet today.</p>
              ) : (
                <div className="space-y-2">
                  {adminTodayList.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <p className="text-sm font-medium">
                          {record.users?.profiles?.full_name || record.users?.email || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {record.check_in ? `In: ${new Date(record.check_in).toLocaleTimeString()}` : "No check-in"}
                          {record.check_out ? ` · Out: ${new Date(record.check_out).toLocaleTimeString()}` : " · No check-out"}
                        </p>
                      </div>
                      <Badge className={getStatusBadgeClass(record.status)}>
                        {record.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Monthly Summary ({attendanceMonth})</h2>
              {adminLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : adminMonthSummary ? (
                <div className="flex flex-wrap gap-4">
                  {Object.entries(adminMonthSummary as Record<string, unknown>).map(([status, count]) => {
                    const summaryCount = typeof count === "number" || typeof count === "string" ? count : 0;

                    return (
                      <div key={status} className="flex items-center gap-2">
                        <Badge className={getStatusBadgeClass(status)}>
                          {status}
                        </Badge>
                        <span className="text-sm font-medium">{summaryCount}</span>
                      </div>
                    );
                  })}
                  {Object.keys(adminMonthSummary).length === 0 && (
                    <p className="text-sm text-muted-foreground">No records this month.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No summary available.</p>
              )}
            </Card>
          </>
        )}

        {/* Status Badge Showcase (keep for now) */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Status Badge Showcase</h2>
          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusBadgeClass("present")}>Present</Badge>
            <Badge className={getStatusBadgeClass("absent")}>Absent</Badge>
            <Badge className={getStatusBadgeClass("half_day")}>Half Day</Badge>
            <Badge className={getStatusBadgeClass("leave")}>Leave</Badge>
            <Badge className={getStatusBadgeClass("pending")}>Pending</Badge>
            <Badge className={getStatusBadgeClass("approved")}>Approved</Badge>
            <Badge className={getStatusBadgeClass("rejected")}>Rejected</Badge>
            <Badge className={getStatusBadgeClass("admin")}>Admin</Badge>
            <Badge className={getStatusBadgeClass("employee")}>Employee</Badge>
          </div>
        </Card>

        {/* Input and Button (keep for now) */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Input and Button</h2>
          <Input placeholder="Sample input" className="mb-3" />
          <Button variant="outline" onClick={handleLogout}>Log out</Button>
        </Card>
      </div>
    </main>
  );
}