import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusBadgeClass, getStatusDotClass, getStatusLabel } from "@/lib/status";

type AuthState =
  | "loading"
  | "login"
  | "forgotPassword"
  | "resendVerification"
  | "resetPassword"
  | "changePassword"
  | "authenticated";

type NavKey = "dashboard" | "attendance" | "profile" | "leave" | "notifications";

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

  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");

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

  // Profile states
  const [profileData, setProfileData] = useState<any>(null);
  const [activeProfileTab, setActiveProfileTab] = useState("myProfile");
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Salary states
  const [salaryData, setSalaryData] = useState<any>(null);
  const [salaryForm, setSalaryForm] = useState({ wage_monthly: "", effective_from: "" });
  const [salaryPreview, setSalaryPreview] = useState<any>(null);
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryError, setSalaryError] = useState("");
  const [salarySuccess, setSalarySuccess] = useState("");

  // Leave states
  const [leaveBalances, setLeaveBalances] = useState({ paid: 12, sick: 6 });
  const [leaveList, setLeaveList] = useState<any[]>([]);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "paid",
    start_date: "",
    end_date: "",
    allocation_days: "",
    remarks: "",
    attachment_url: "",
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveSuccess, setLeaveSuccess] = useState("");
  const [approvalProcessing, setApprovalProcessing] = useState<string | null>(null);

  // Dashboard states
  const [empDashboardData, setEmpDashboardData] = useState<any>(null);
  const [adminDashboardData, setAdminDashboardData] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Notification states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

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

  useEffect(() => {
    if (authState === "authenticated" && session) {
      loadTodayAttendance();
      loadProfile();
      loadSalary();
      loadLeaveData();
      loadDashboardData();
      loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, session, role]);

  useEffect(() => {
    if (authState === "authenticated" && session && role === "employee") {
      loadAttendanceList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, session, role, attendanceMonth]);

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
      loadAttendanceList();
      loadAdminData();
      loadDashboardData();
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
      loadAttendanceList();
      loadAdminData();
      loadDashboardData();
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

  // ===== Profile Helpers =====

  async function loadProfile() {
    if (!session) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (!error && data) {
      setProfileData(data);
      setProfileForm({
        full_name: data.full_name || "",
        phone: data.phone || "",
        address: data.address || "",
        profile_picture_url: data.profile_picture_url || "",
        job_position: data.job_position || "",
        department: data.department || "",
        location: data.location || "",
        date_of_birth: data.date_of_birth || "",
        nationality: data.nationality || "",
        gender: data.gender || "",
        marital_status: data.marital_status || "",
        personal_email: data.personal_email || "",
        date_of_joining: data.date_of_joining || "",
        bank_account_number: data.bank_account_number || "",
        bank_name: data.bank_name || "",
        ifsc_code: data.ifsc_code || "",
        uan_no: data.uan_no || "",
        pan_no: data.pan_no || "",
        resume_url: data.resume_url || "",
        about: data.about || "",
        skills: (data.skills || []).join(", "),
      });
    }
  }

  function handleProfileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setProfileForm((prev: any) => ({ ...prev, [name]: value }));
  }

  function startEditProfile() {
    setProfileError("");
    setProfileSuccess("");
    setEditMode(true);
  }

  function cancelEditProfile() {
    setEditMode(false);
    setProfileError("");
    setProfileSuccess("");
    if (profileData) {
      setProfileForm({
        full_name: profileData.full_name || "",
        phone: profileData.phone || "",
        address: profileData.address || "",
        profile_picture_url: profileData.profile_picture_url || "",
        job_position: profileData.job_position || "",
        department: profileData.department || "",
        location: profileData.location || "",
        date_of_birth: profileData.date_of_birth || "",
        nationality: profileData.nationality || "",
        gender: profileData.gender || "",
        marital_status: profileData.marital_status || "",
        personal_email: profileData.personal_email || "",
        date_of_joining: profileData.date_of_joining || "",
        bank_account_number: profileData.bank_account_number || "",
        bank_name: profileData.bank_name || "",
        ifsc_code: profileData.ifsc_code || "",
        uan_no: profileData.uan_no || "",
        pan_no: profileData.pan_no || "",
        resume_url: profileData.resume_url || "",
        about: profileData.about || "",
        skills: (profileData.skills || []).join(", "),
      });
    }
  }

  async function saveProfile() {
    if (!session) return;
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    let updatePayload: any = {};

    if (role === "admin") {
      updatePayload = {
        full_name: profileForm.full_name,
        phone: profileForm.phone,
        address: profileForm.address,
        profile_picture_url: profileForm.profile_picture_url,
        job_position: profileForm.job_position,
        department: profileForm.department,
        location: profileForm.location,
        date_of_birth: profileForm.date_of_birth || null,
        nationality: profileForm.nationality,
        gender: profileForm.gender,
        marital_status: profileForm.marital_status,
        personal_email: profileForm.personal_email,
        date_of_joining: profileForm.date_of_joining,
        bank_account_number: profileForm.bank_account_number,
        bank_name: profileForm.bank_name,
        ifsc_code: profileForm.ifsc_code,
        uan_no: profileForm.uan_no,
        pan_no: profileForm.pan_no,
        resume_url: profileForm.resume_url,
        about: profileForm.about,
        skills: profileForm.skills
          ? profileForm.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
      };
    } else {
      updatePayload = {
        phone: profileForm.phone,
        address: profileForm.address,
        profile_picture_url: profileForm.profile_picture_url,
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", session.user.id)
      .select()
      .single();

    if (error) {
      setProfileError(error.message);
    } else {
      setProfileSuccess("Profile updated successfully.");
      setProfileData(data);
      setEditMode(false);
      loadProfile();
    }
    setProfileSaving(false);
  }

  function renderProfileTabContent() {
    if (!profileData) {
      return <p className="text-sm text-muted-foreground">No profile found.</p>;
    }

    switch (activeProfileTab) {
      case "myProfile":
        return (
          <div className="space-y-2">
            <p><span className="font-medium">Full Name:</span> {profileData.full_name}</p>
            <p><span className="font-medium">Job Position:</span> {profileData.job_position || "—"}</p>
            <p><span className="font-medium">Department:</span> {profileData.department || "—"}</p>
            <p><span className="font-medium">Location:</span> {profileData.location || "—"}</p>
            <p><span className="font-medium">Phone:</span> {profileData.phone || "—"}</p>
            <p><span className="font-medium">Address:</span> {profileData.address || "—"}</p>
          </div>
        );
      case "resume":
        return (
          <div className="space-y-2">
            <p><span className="font-medium">Resume URL:</span> {profileData.resume_url || "—"}</p>
            <p><span className="font-medium">Date of Joining:</span> {profileData.date_of_joining || "—"}</p>
            <p><span className="font-medium">Bank Account Number:</span> {profileData.bank_account_number || "—"}</p>
            <p><span className="font-medium">Bank Name:</span> {profileData.bank_name || "—"}</p>
            <p><span className="font-medium">IFSC Code:</span> {profileData.ifsc_code || "—"}</p>
            <p><span className="font-medium">UAN No:</span> {profileData.uan_no || "—"}</p>
            <p><span className="font-medium">PAN No:</span> {profileData.pan_no || "—"}</p>
          </div>
        );
      case "privateInfo":
        return (
          <div className="space-y-2">
            <p><span className="font-medium">Date of Birth:</span> {profileData.date_of_birth || "—"}</p>
            <p><span className="font-medium">Nationality:</span> {profileData.nationality || "—"}</p>
            <p><span className="font-medium">Gender:</span> {profileData.gender || "—"}</p>
            <p><span className="font-medium">Marital Status:</span> {profileData.marital_status || "—"}</p>
            <p><span className="font-medium">Personal Email:</span> {profileData.personal_email || "—"}</p>
          </div>
        );
      case "skills":
        return (
          <div className="space-y-2">
            <p><span className="font-medium">Skills:</span></p>
            {profileData.skills && profileData.skills.length > 0 ? (
              <ul className="list-disc pl-5">
                {profileData.skills.map((skill: string, idx: number) => (
                  <li key={idx}>{skill}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No skills listed.</p>
            )}
          </div>
        );
      case "about":
        return (
          <div className="space-y-2">
            <p className="text-sm whitespace-pre-wrap">{profileData.about || "No about information."}</p>
          </div>
        );
      case "salary":
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Salary details are managed in the Salary section.</p>
          </div>
        );
      default:
        return null;
    }
  }

  // ===== Salary Helpers =====

  async function loadSalary() {
    if (!session) return;
    const { data, error } = await supabase
      .from("salary_structures")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!error && data) {
      setSalaryData(data);
      setSalaryForm({
        wage_monthly: String(data.wage_monthly),
        effective_from: data.effective_from,
      });
    }
  }

  async function calculateSalaryPreview() {
    if (!salaryForm.wage_monthly || !salaryForm.effective_from) {
      setSalaryError("Wage and effective date are required.");
      return;
    }
    setSalaryError("");
    const { data, error } = await supabase.rpc("calculate_salary_components", {
      wage: parseFloat(salaryForm.wage_monthly),
      effective_from: salaryForm.effective_from,
    });
    if (error) {
      setSalaryError(error.message);
      setSalaryPreview(null);
    } else {
      setSalaryPreview(data[0]);
    }
  }

  async function saveSalary() {
    if (!session || role !== "admin") return;
    setSalarySaving(true);
    setSalaryError("");
    setSalarySuccess("");

    const payload = {
      user_id: session.user.id,
      wage_monthly: parseFloat(salaryForm.wage_monthly),
      effective_from: salaryForm.effective_from,
    };

    const { data, error } = await supabase
      .from("salary_structures")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      setSalaryError(error.message);
    } else {
      setSalarySuccess("Salary saved successfully.");
      setSalaryData(data);
      loadSalary();
    }
    setSalarySaving(false);
  }

  // ===== Leave Helpers =====

  async function loadLeaveData() {
    if (!session) return;
    if (role === "admin") {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          *,
          users!user_id (
            id,
            email,
            profiles!profiles_user_id_fkey (full_name)
          )
        `)
        .order("created_at", { ascending: false });
      if (!error) setLeaveList(data || []);
    } else {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (!error) setLeaveList(data || []);
    }
  }

  async function applyLeave() {
    if (!session) return;
    setLeaveSubmitting(true);
    setLeaveError("");
    setLeaveSuccess("");

    const start = new Date(leaveForm.start_date);
    const end = new Date(leaveForm.end_date);
    const allocationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { data: overlaps, error: overlapError } = await supabase
      .from("leave_requests")
      .select("id")
      .eq("user_id", session.user.id)
      .neq("status", "rejected")
      .lte("start_date", leaveForm.end_date)
      .gte("end_date", leaveForm.start_date);

    if (overlapError) {
      setLeaveError(overlapError.message);
      setLeaveSubmitting(false);
      return;
    }
    if (overlaps && overlaps.length > 0) {
      setLeaveError("Overlapping leave request exists.");
      setLeaveSubmitting(false);
      return;
    }

    const payload = {
      user_id: session.user.id,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      allocation_days: allocationDays,
      remarks: leaveForm.remarks,
      attachment_url: leaveForm.attachment_url,
    };

    const { error: insertError } = await supabase
      .from("leave_requests")
      .insert(payload);

    if (insertError) {
      setLeaveError(insertError.message);
    } else {
      setLeaveSuccess("Leave applied successfully.");
      setLeaveForm({
        leave_type: "paid",
        start_date: "",
        end_date: "",
        allocation_days: "",
        remarks: "",
        attachment_url: "",
      });
      loadLeaveData();
    }
    setLeaveSubmitting(false);
  }

  async function approveLeave(id: string) {
    setApprovalProcessing(id);
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "approved", reviewed_by: session.user.id })
      .eq("id", id);
    if (!error) loadLeaveData();
    setApprovalProcessing(null);
  }

  async function rejectLeave(id: string) {
    setApprovalProcessing(id);
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "rejected", reviewed_by: session.user.id })
      .eq("id", id);
    if (!error) loadLeaveData();
    setApprovalProcessing(null);
  }

  // ===== Dashboard Helpers =====

  async function loadDashboardData() {
    if (!session) return;
    setDashboardLoading(true);
    if (role === "employee") {
      const monthStart = getMonthStartEnd(attendanceMonth).start;
      const today = getLocalDateString();

      const { data: presentCountData, error: presentError } = await supabase
        .from("attendance")
        .select("id", { count: "exact" })
        .eq("user_id", session.user.id)
        .eq("status", "present")
        .gte("date", monthStart);
      if (presentError) console.error(presentError);

      const { data: leaveDaysData, error: leaveDaysError } = await supabase
        .from("leave_requests")
        .select("allocation_days")
        .eq("user_id", session.user.id)
        .eq("status", "approved")
        .gte("start_date", monthStart);
      if (leaveDaysError) console.error(leaveDaysError);

      const { data: pendingLeavesData, error: pendingError } = await supabase
        .from("leave_requests")
        .select("id", { count: "exact" })
        .eq("user_id", session.user.id)
        .eq("status", "pending");
      if (pendingError) console.error(pendingError);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      const weekStartStr = weekStart.toISOString().slice(0,10);
      const { data: weekData, error: weekError } = await supabase
        .from("attendance")
        .select("date, status")
        .eq("user_id", session.user.id)
        .gte("date", weekStartStr);
      if (weekError) console.error(weekError);

      const leaveDaysSum = (leaveDaysData || []).reduce((sum, row) => sum + (row.allocation_days || 0), 0);
      const pendingCount = pendingLeavesData?.length || 0;
      const presentCount = presentCountData?.length || 0;

      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().slice(0,10);
        const record = (weekData || []).find((r: any) => r.date === dateStr);
        days.push({ date: dateStr, status: record ? record.status : "none" });
      }

      setEmpDashboardData({
        presentCount,
        leaveDaysSum,
        pendingCount,
        weekDays: days,
      });
    } else if (role === "admin") {
      const today = getLocalDateString();

      const { data: employees, error: empError } = await supabase
        .from("profiles")
        .select(`
          user_id,
          full_name,
          department,
          users!profiles_user_id_fkey (role)
        `)
        .eq("users.role", "employee");

      if (empError) {
        console.error(empError);
        setDashboardLoading(false);
        return;
      }

      const { data: todayAttendance, error: todayError } = await supabase
        .from("attendance")
        .select("user_id, status")
        .eq("date", today);

      const { data: approvedLeaves, error: leaveError } = await supabase
        .from("leave_requests")
        .select("user_id")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);

      if (todayError || leaveError) {
        console.error(todayError || leaveError);
      }

      const empList = (employees || []).map((profile: any) => {
        const att = (todayAttendance || []).find((a: any) => a.user_id === profile.user_id);
        const leave = (approvedLeaves || []).find((l: any) => l.user_id === profile.user_id);
        let status = "absent";
        if (att) status = att.status;
        if (leave) status = "leave";
        return { ...profile, todayStatus: status };
      });

      setAdminDashboardData(empList);
    }
    setDashboardLoading(false);
  }

  function getGreeting() {
    const hour = new Date().getHours();
    const name = profileData?.full_name?.split(" ")[0] || "there";
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  }

  // ===== Notifications Helpers =====

  async function loadNotifications() {
    if (!session) return;
    setNotificationsLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (!error) {
      setNotifications(data || []);
    }
    setNotificationsLoading(false);
  }

  async function markNotificationRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (!error) {
      loadNotifications();
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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

  if (authState === "forgotPassword" || authState === "resendVerification" || authState === "resetPassword" || authState === "changePassword") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
          <h1 className="text-xl font-semibold">
            {authState === "forgotPassword" && "Reset password"}
            {authState === "resendVerification" && "Resend verification email"}
            {authState === "resetPassword" && "Set a new password"}
            {authState === "changePassword" && "Change your password"}
          </h1>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          {authState === "forgotPassword" && (
            <>
              <input className="w-full rounded border px-3 py-2" placeholder="Email" type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} />
              <Button className="w-full" onClick={handleForgotPassword} disabled={loading}>{loading ? "Sending…" : "Send reset email"}</Button>
            </>
          )}
          {authState === "resendVerification" && (
            <>
              <input className="w-full rounded border px-3 py-2" placeholder="Email" type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} />
              <Button className="w-full" onClick={handleResendVerification} disabled={loading}>{loading ? "Sending…" : "Resend verification"}</Button>
            </>
          )}
          {authState === "resetPassword" && (
            <>
              <input className="w-full rounded border px-3 py-2" placeholder="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <input className="w-full rounded border px-3 py-2" placeholder="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <Button className="w-full" onClick={handleResetPassword} disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
            </>
          )}
          {authState === "changePassword" && (
            <>
              <input className="w-full rounded border px-3 py-2" placeholder="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <input className="w-full rounded border px-3 py-2" placeholder="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <Button className="w-full" onClick={handlePasswordChange} disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
              <Button variant="outline" className="w-full" onClick={handleLogout}>Log out</Button>
            </>
          )}
          <Button variant="outline" className="w-full" onClick={() => setAuthState("login")}>Back to sign in</Button>
        </div>
      </main>
    );
  }

  // Authenticated view with navigation
  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Dayflow</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant={activeNav === "dashboard" ? "default" : "outline"} onClick={() => setActiveNav("dashboard")}>Dashboard</Button>
          <Button variant={activeNav === "attendance" ? "default" : "outline"} onClick={() => setActiveNav("attendance")}>Attendance</Button>
          <Button variant={activeNav === "profile" ? "default" : "outline"} onClick={() => setActiveNav("profile")}>Profile</Button>
          <Button variant={activeNav === "leave" ? "default" : "outline"} onClick={() => setActiveNav("leave")}>Leave</Button>
          <Button variant={activeNav === "notifications" ? "default" : "outline"} onClick={() => setActiveNav("notifications")}>
            Notifications {unreadCount > 0 && <span className="ml-1 rounded-full bg-red-500 text-white text-xs px-1.5">{unreadCount}</span>}
          </Button>
          <Button variant="outline" onClick={handleLogout}>Log out</Button>
        </div>
      </div>

      {/* DASHBOARD */}
      {activeNav === "dashboard" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{getGreeting()}</h2>

          {role === "employee" && empDashboardData ? (
            <>
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold">Quick Check-In</h3>
                {todayAttendance?.check_in ? (
                  <p className="text-sm">Checked in at {new Date(todayAttendance.check_in).toLocaleTimeString()}</p>
                ) : (
                  <Button onClick={handleCheckIn} disabled={checkInLoading}>
                    {checkInLoading ? "Checking in…" : "Check In"}
                  </Button>
                )}
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-semibold">Present Days</h3>
                  <p className="text-2xl font-bold">{empDashboardData.presentCount}</p>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-semibold">Leave Days</h3>
                  <p className="text-2xl font-bold">{empDashboardData.leaveDaysSum}</p>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-semibold">Pending Leaves</h3>
                  <p className="text-2xl font-bold">{empDashboardData.pendingCount}</p>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold">Last 7 Days</h3>
                <div className="flex items-end gap-2 h-24">
                  {empDashboardData.weekDays.map((day: any) => (
                    <div key={day.date} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t ${day.status === "present" ? "bg-green-500" : day.status === "absent" ? "bg-yellow-500" : day.status === "half_day" ? "bg-orange-500" : day.status === "leave" ? "bg-blue-500" : "bg-gray-300"}`}
                        style={{ height: `${day.status === "present" ? 40 : day.status === "absent" ? 20 : day.status === "half_day" ? 30 : day.status === "leave" ? 40 : 10}px` }}
                      />
                      <span className="text-xs mt-1">{new Date(day.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setActiveNav("leave")}>Apply for Leave</Button>
                  <Button variant="outline" onClick={() => setActiveNav("profile")}>View Profile</Button>
                  <Button variant="outline" onClick={() => setActiveNav("attendance")}>View Attendance</Button>
                </div>
              </Card>
            </>
          ) : role === "admin" ? (
            <>
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold">Employee Status Today</h3>
                {dashboardLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : adminDashboardData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {adminDashboardData.map((emp: any) => (
                      <div key={emp.user_id} className="flex items-center gap-3 rounded border p-3">
                        <span className={`inline-block h-3 w-3 rounded-full ${getStatusDotClass(emp.todayStatus)}`} />
                        <div>
                          <p className="text-sm font-medium">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.department || "No department"}</p>
                        </div>
                        <span className="ml-auto text-xs">{getStatusLabel(emp.todayStatus)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold">Pending Approvals</h3>
                {leaveList.filter((l) => l.status === "pending").length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending leave requests.</p>
                ) : (
                  <div className="space-y-2">
                    {leaveList.filter((l) => l.status === "pending").slice(0,5).map((leave) => (
                      <div key={leave.id} className="flex items-center justify-between rounded border p-2">
                        <div>
                          <p className="text-sm font-medium">{leave.users?.profiles?.full_name || leave.users?.email || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{leave.leave_type} · {leave.start_date} → {leave.end_date}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => approveLeave(leave.id)} disabled={approvalProcessing === leave.id}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectLeave(leave.id)} disabled={approvalProcessing === leave.id}>Reject</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button className="mt-2" variant="outline" onClick={() => setActiveNav("leave")}>View All Leaves</Button>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* ATTENDANCE */}
      {activeNav === "attendance" && (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">My Attendance Today</h2>
            {!todayAttendance ? (
              <Button onClick={handleCheckIn} disabled={checkInLoading}>{checkInLoading ? "Checking in…" : "Check In"}</Button>
            ) : todayAttendance.check_out ? (
              <div className="space-y-2">
                <p>Check-in: {new Date(todayAttendance.check_in).toLocaleTimeString()}</p>
                <p>Check-out: {new Date(todayAttendance.check_out).toLocaleTimeString()}</p>
                <p>Work hours: {todayAttendance.work_hours?.toFixed(2)}</p>
                <p>Extra hours: {todayAttendance.extra_hours?.toFixed(2)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p>Checked in at {new Date(todayAttendance.check_in).toLocaleTimeString()}</p>
                <Button onClick={handleCheckOut} disabled={checkOutLoading}>{checkOutLoading ? "Checking out…" : "Check Out"}</Button>
              </div>
            )}
          </Card>

          {role === "employee" && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Monthly Attendance</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}>←</Button>
                  <span>{attendanceMonth}</span>
                  <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>→</Button>
                </div>
              </div>
              {attendanceListLoading ? (
                <p>Loading…</p>
              ) : attendanceListError ? (
                <p className="text-red-500">{attendanceListError}</p>
              ) : attendanceList.length === 0 ? (
                <p>No attendance records.</p>
              ) : (
                <div className="space-y-2">
                  {attendanceList.map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <p className="text-sm font-medium">{record.date}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.check_in ? `In: ${new Date(record.check_in).toLocaleTimeString()}` : "No check-in"}
                          {record.check_out ? ` · Out: ${new Date(record.check_out).toLocaleTimeString()}` : ""}
                        </p>
                      </div>
                      <Badge className={getStatusBadgeClass(record.status)}>{record.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {role === "admin" && (
            <>
              <Card className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Today's Attendance (All Employees)</h3>
                {adminLoading ? (
                  <p>Loading…</p>
                ) : adminError ? (
                  <p className="text-red-500">{adminError}</p>
                ) : adminTodayList.length === 0 ? (
                  <p>No attendance records yet today.</p>
                ) : (
                  <div className="space-y-2">
                    {adminTodayList.map((record) => (
                      <div key={record.id} className="flex items-center justify-between rounded border p-2">
                        <div>
                          <p className="text-sm font-medium">{record.users?.profiles?.full_name || record.users?.email || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {record.check_in ? `In: ${new Date(record.check_in).toLocaleTimeString()}` : "No check-in"}
                            {record.check_out ? ` · Out: ${new Date(record.check_out).toLocaleTimeString()}` : ""}
                          </p>
                        </div>
                        <Badge className={getStatusBadgeClass(record.status)}>{record.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Monthly Summary ({attendanceMonth})</h3>
                {adminMonthSummary ? (
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(adminMonthSummary).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2">
                        <Badge className={getStatusBadgeClass(status)}>{status}</Badge>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No summary available.</p>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* PROFILE */}
      {activeNav === "profile" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Profile</h2>
              {!editMode ? (
                <Button variant="outline" size="sm" onClick={startEditProfile}>Edit Profile</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEditProfile}>Cancel</Button>
                  <Button size="sm" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? "Saving…" : "Save"}</Button>
                </div>
              )}
            </div>
            {profileError && <p className="text-red-500">{profileError}</p>}
            {profileSuccess && <p className="text-green-600">{profileSuccess}</p>}
            <div className="mb-3 flex flex-wrap gap-1">
              {[
                { key: "myProfile", label: "My Profile" },
                { key: "resume", label: "Resume" },
                { key: "privateInfo", label: "Private Info" },
                { key: "skills", label: "Skills" },
                { key: "about", label: "About" },
                ...(role === "admin" ? [{ key: "salary", label: "Salary Info" }] : []),
              ].map((tab) => (
                <Button key={tab.key} variant={activeProfileTab === tab.key ? "default" : "outline"} size="sm" onClick={() => setActiveProfileTab(tab.key)}>
                  {tab.label}
                </Button>
              ))}
            </div>
            {editMode ? (
              <div className="space-y-2">
                {role === "admin" ? (
                  <>
                    <Input name="full_name" placeholder="Full Name" value={profileForm.full_name} onChange={handleProfileInputChange} />
                    <Input name="phone" placeholder="Phone" value={profileForm.phone} onChange={handleProfileInputChange} />
                    <Input name="address" placeholder="Address" value={profileForm.address} onChange={handleProfileInputChange} />
                    <Input name="profile_picture_url" placeholder="Profile Picture URL" value={profileForm.profile_picture_url} onChange={handleProfileInputChange} />
                    <Input name="job_position" placeholder="Job Position" value={profileForm.job_position} onChange={handleProfileInputChange} />
                    <Input name="department" placeholder="Department" value={profileForm.department} onChange={handleProfileInputChange} />
                    <Input name="location" placeholder="Location" value={profileForm.location} onChange={handleProfileInputChange} />
                    <Input name="date_of_birth" placeholder="Date of Birth (YYYY-MM-DD)" value={profileForm.date_of_birth} onChange={handleProfileInputChange} />
                    <Input name="nationality" placeholder="Nationality" value={profileForm.nationality} onChange={handleProfileInputChange} />
                    <Input name="gender" placeholder="Gender" value={profileForm.gender} onChange={handleProfileInputChange} />
                    <Input name="marital_status" placeholder="Marital Status" value={profileForm.marital_status} onChange={handleProfileInputChange} />
                    <Input name="personal_email" placeholder="Personal Email" value={profileForm.personal_email} onChange={handleProfileInputChange} />
                    <Input name="date_of_joining" placeholder="Date of Joining (YYYY-MM-DD)" value={profileForm.date_of_joining} onChange={handleProfileInputChange} />
                    <Input name="bank_account_number" placeholder="Bank Account Number" value={profileForm.bank_account_number} onChange={handleProfileInputChange} />
                    <Input name="bank_name" placeholder="Bank Name" value={profileForm.bank_name} onChange={handleProfileInputChange} />
                    <Input name="ifsc_code" placeholder="IFSC Code" value={profileForm.ifsc_code} onChange={handleProfileInputChange} />
                    <Input name="uan_no" placeholder="UAN No" value={profileForm.uan_no} onChange={handleProfileInputChange} />
                    <Input name="pan_no" placeholder="PAN No" value={profileForm.pan_no} onChange={handleProfileInputChange} />
                    <Input name="resume_url" placeholder="Resume URL" value={profileForm.resume_url} onChange={handleProfileInputChange} />
                    <Input name="about" placeholder="About" value={profileForm.about} onChange={handleProfileInputChange} />
                    <Input name="skills" placeholder="Skills (comma separated)" value={profileForm.skills} onChange={handleProfileInputChange} />
                  </>
                ) : (
                  <>
                    <Input name="phone" placeholder="Phone" value={profileForm.phone} onChange={handleProfileInputChange} />
                    <Input name="address" placeholder="Address" value={profileForm.address} onChange={handleProfileInputChange} />
                    <Input name="profile_picture_url" placeholder="Profile Picture URL" value={profileForm.profile_picture_url} onChange={handleProfileInputChange} />
                  </>
                )}
              </div>
            ) : (
              renderProfileTabContent()
            )}
          </Card>

          {role === "admin" && activeProfileTab === "salary" && (
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Salary Configuration</h3>
              <div className="space-y-2">
                <Input name="wage_monthly" placeholder="Wage" value={salaryForm.wage_monthly} onChange={(e) => setSalaryForm({...salaryForm, wage_monthly: e.target.value})} />
                <Input name="effective_from" type="date" value={salaryForm.effective_from} onChange={(e) => setSalaryForm({...salaryForm, effective_from: e.target.value})} />
                <Button onClick={calculateSalaryPreview}>Calculate Preview</Button>
                <Button onClick={saveSalary} disabled={salarySaving}>{salarySaving ? "Saving…" : "Save"}</Button>
                {salaryError && <p className="text-red-500">{salaryError}</p>}
                {salarySuccess && <p className="text-green-600">{salarySuccess}</p>}
                {salaryPreview && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span>Basic: {salaryPreview.basic}</span>
                    <span>HRA: {salaryPreview.hra}</span>
                    <span>Standard Allowance: {salaryPreview.standard_allowance}</span>
                    <span>Performance Bonus: {salaryPreview.performance_bonus}</span>
                    <span>LTA: {salaryPreview.lta}</span>
                    <span>Fixed Allowance: {salaryPreview.fixed_allowance}</span>
                    <span>PF Employee: {salaryPreview.pf_employee}</span>
                    <span>PF Employer: {salaryPreview.pf_employer}</span>
                    <span>Professional Tax: {salaryPreview.professional_tax}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* LEAVE */}
      {activeNav === "leave" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold">Paid Time Off</h3>
              <p className="text-2xl font-bold">{leaveBalances.paid} days available</p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold">Sick Time Off</h3>
              <p className="text-2xl font-bold">{leaveBalances.sick} days available</p>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Apply for Leave</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select className="border rounded px-3 py-2" value={leaveForm.leave_type} onChange={(e) => setLeaveForm({...leaveForm, leave_type: e.target.value})}>
                <option value="paid">Paid</option>
                <option value="sick">Sick</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <Input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({...leaveForm, start_date: e.target.value})} />
              <Input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({...leaveForm, end_date: e.target.value})} />
              <Input placeholder="Remarks" value={leaveForm.remarks} onChange={(e) => setLeaveForm({...leaveForm, remarks: e.target.value})} />
              <Input placeholder="Attachment URL (required for Sick)" value={leaveForm.attachment_url} onChange={(e) => setLeaveForm({...leaveForm, attachment_url: e.target.value})} />
            </div>
            <Button className="mt-2" onClick={applyLeave} disabled={leaveSubmitting}>{leaveSubmitting ? "Submitting…" : "Submit Leave"}</Button>
            {leaveError && <p className="text-red-500 mt-2">{leaveError}</p>}
            {leaveSuccess && <p className="text-green-600 mt-2">{leaveSuccess}</p>}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Leave List</h3>
            {leaveList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests.</p>
            ) : (
              <div className="space-y-2">
                {leaveList.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between rounded border p-2">
                    <div>
                      <p className="text-sm font-medium">
                        {role === "admin" ? (leave.users?.profiles?.full_name || leave.users?.email || "Unknown") : `${leave.leave_type} leave`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {leave.start_date} → {leave.end_date} · {leave.allocation_days} days
                      </p>
                      <p className="text-xs text-muted-foreground">{leave.remarks || "No remarks"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusBadgeClass(leave.status)}>{leave.status}</Badge>
                      {role === "admin" && leave.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => approveLeave(leave.id)} disabled={approvalProcessing === leave.id}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectLeave(leave.id)} disabled={approvalProcessing === leave.id}>Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {activeNav === "notifications" && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Notifications</h2>
          {notificationsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl">🔔</span>
              <p className="mt-2 text-sm text-muted-foreground">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start justify-between rounded border p-2">
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {n.is_read ? (
                    <span className="text-xs text-muted-foreground">Read</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => markNotificationRead(n.id)}>Mark as read</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </main>
  );
}