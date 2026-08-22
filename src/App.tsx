import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusBadgeClass, getStatusDotClass, getStatusLabel } from "@/lib/status";
import {
  LayoutDashboard,
  CalendarCheck,
  User,
  CalendarDays,
  Bell,
  Wallet,
  Users,
  Megaphone,
  FolderOpen,
  LogOut,
  KeyRound,
  Upload,
  Download,
  Search,
  X,
} from "lucide-react";

type AuthState =
  | "loading"
  | "login"
  | "forgotPassword"
  | "resendVerification"
  | "resetPassword"
  | "changePassword"
  | "authenticated";

type NavKey =
  | "dashboard"
  | "attendance"
  | "profile"
  | "leave"
  | "payslip"
  | "directory"
  | "announcements"
  | "documents"
  | "notifications";

/* ---------- Reusable UI helpers ---------- */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-800 ${className}`} />;
}

function EmptyState({
  icon,
  message,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-3xl text-muted-foreground">{icon}</span>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction && (
        <Button variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-500" role="alert" aria-live="assertive">
      Something went wrong: {message}
    </p>
  );
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <p className="text-sm text-green-600" role="status" aria-live="polite">
      {message}
    </p>
  );
}

function Avatar({ src, name, size = "md" }: { src?: string | null; name?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-24 w-24 text-2xl" : "h-10 w-10 text-sm";
  if (src) {
    return <img src={src} alt={name || "Profile"} className={`${sizeClass} rounded-full object-cover`} />;
  }
  const initials =
    (name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-gray-200 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200`}>
      {initials}
    </div>
  );
}

function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num || 0);
}

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string>("");
  const [, setMustChangePassword] = useState(false);

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
  const [confirmBulkAbsent, setConfirmBulkAbsent] = useState(false);
  const [bulkAbsentLoading, setBulkAbsentLoading] = useState(false);
  const [bulkAbsentResult, setBulkAbsentResult] = useState("");
  const [bulkAbsentError, setBulkAbsentError] = useState("");

  // Profile states
  const [profileData, setProfileData] = useState<any>(null);
  const [activeProfileTab, setActiveProfileTab] = useState("myProfile");
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Profile picture states
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Change password states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirmPassword, setCpConfirmPassword] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState("");

  // Salary states
  const [, setSalaryData] = useState<any>(null);
  const [salaryForm, setSalaryForm] = useState({ wage_monthly: "", effective_from: "" });
  const [salaryPreview, setSalaryPreview] = useState<any>(null);
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryError, setSalaryError] = useState("");
  const [salarySuccess, setSalarySuccess] = useState("");

  // Payslip states
  const [payslipSelectedUser, setPayslipSelectedUser] = useState("");
  const [payslipData, setPayslipData] = useState<any>(null);
  const [payslipEmployee, setPayslipEmployee] = useState<any>(null);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [payslipError, setPayslipError] = useState("");

  // Directory states
  const [directoryEmployees, setDirectoryEmployees] = useState<any[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directorySelected, setDirectorySelected] = useState<any>(null);

  // Leave states
  const [leaveBalances] = useState({ paid: 12, sick: 6 });
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
  const [approvedLeavesMonth, setApprovedLeavesMonth] = useState<any[]>([]);

  // Announcements states
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState("");
  const [announcementForm, setAnnouncementForm] = useState({ title: "", content: "" });
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState("");

  // Documents states
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");
  const [documentsViewUser, setDocumentsViewUser] = useState("");

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
      loadAnnouncements();
      loadDocuments(documentsViewUser);
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

  useEffect(() => {
    if (authState === "authenticated" && session) {
      loadApprovedLeaves();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, session, role, attendanceMonth]);

  useEffect(() => {
    if (authState === "authenticated" && session && role === "employee") {
      loadPayslip(session.user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, session, role]);

  useEffect(() => {
    if (authState === "authenticated" && session && role === "admin") {
      loadDirectory();
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

  async function bulkMarkAbsent() {
    if (!session) return;
    setBulkAbsentLoading(true);
    setBulkAbsentError("");
    setBulkAbsentResult("");

    const today = getLocalDateString();

    const { data: employees, error: empError } = await supabase
      .from("profiles")
      .select(`
        user_id,
        users!profiles_user_id_fkey (role)
      `)
      .eq("users.role", "employee");

    if (empError) {
      setBulkAbsentError(empError.message);
      setBulkAbsentLoading(false);
      return;
    }

    const { data: todayRecords, error: todayError } = await supabase
      .from("attendance")
      .select("user_id")
      .eq("date", today);

    if (todayError) {
      setBulkAbsentError(todayError.message);
      setBulkAbsentLoading(false);
      return;
    }

    const checkedInIds = new Set((todayRecords || []).map((r: any) => r.user_id));
    const missing = (employees || [])
      .map((p: any) => p.user_id)
      .filter((id: string) => !checkedInIds.has(id));

    if (missing.length === 0) {
      setBulkAbsentResult("All employees have an attendance record today. Nothing to mark.");
      setConfirmBulkAbsent(false);
      setBulkAbsentLoading(false);
      return;
    }

    const inserts = missing.map((userId: string) => ({
      user_id: userId,
      date: today,
      status: "absent",
    }));

    const { error: insertError } = await supabase.from("attendance").insert(inserts);

    if (insertError) {
      setBulkAbsentError(insertError.message);
    } else {
      setBulkAbsentResult(`Marked ${missing.length} employee(s) as absent for today.`);
      loadAdminData();
      loadDashboardData();
    }
    setConfirmBulkAbsent(false);
    setBulkAbsentLoading(false);
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
    setAvatarPreview(null);
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

  async function handleAvatarSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    setProfileError("");
    setProfileSuccess("");

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      setProfileError(`Picture upload failed: ${uploadError.message}`);
      setAvatarUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ profile_picture_url: publicUrl })
      .eq("user_id", session.user.id)
      .select()
      .single();

    if (updateError) {
      setProfileError(`Could not save picture: ${updateError.message}`);
    } else {
      setProfileData(updated);
      setProfileForm((prev: any) => ({ ...prev, profile_picture_url: publicUrl }));
      setProfileSuccess("Profile picture updated.");
    }
    setAvatarUploading(false);
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
      return <EmptyState icon="👤" message="No profile data found." />;
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

  // ===== Change Password Helpers =====

  async function handleChangePasswordSubmit() {
    if (!session) return;
    setCpError("");
    setCpSuccess("");

    if (cpNewPassword.length < 8) {
      setCpError("New password must be at least 8 characters.");
      return;
    }
    if (cpNewPassword !== cpConfirmPassword) {
      setCpError("New passwords do not match.");
      return;
    }

    setCpLoading(true);

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });

    if (verifyError) {
      setCpError("Current password is incorrect.");
      setCpLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: cpNewPassword,
    });

    if (updateError) {
      setCpError(updateError.message);
      setCpLoading(false);
      return;
    }

    setCpSuccess("Password changed successfully.");
    setCurrentPassword("");
    setCpNewPassword("");
    setCpConfirmPassword("");
    setCpLoading(false);
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

  // ===== Payslip Helpers =====

  async function loadPayslip(userId: string) {
    if (!session) return;
    setPayslipLoading(true);
    setPayslipError("");
    setPayslipData(null);
    setPayslipEmployee(null);

    const { data: structure, error: structError } = await supabase
      .from("salary_structures")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (structError) {
      setPayslipError(structError.message);
      setPayslipLoading(false);
      return;
    }
    if (!structure) {
      setPayslipError("No salary structure found for this employee.");
      setPayslipLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, job_position, department")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) console.error(profileError);
    setPayslipEmployee(profile);

    const { data: components, error: rpcError } = await supabase.rpc("calculate_salary_components", {
      wage: structure.wage_monthly,
      effective_from: structure.effective_from,
    });

    if (rpcError) {
      setPayslipError(rpcError.message);
    } else {
      setPayslipData(components?.[0] || null);
    }
    setPayslipLoading(false);
  }

  function handlePayslipUserChange(userId: string) {
    setPayslipSelectedUser(userId);
    if (userId) loadPayslip(userId);
    else {
      setPayslipData(null);
      setPayslipEmployee(null);
    }
  }

  function payslipRows() {
    if (!payslipData) return { earnings: [], deductions: [], gross: 0, net: 0 };
    const num = (v: any) => Number(v || 0);
    const earnings = [
      { label: "Basic", value: num(payslipData.basic) },
      { label: "HRA", value: num(payslipData.hra) },
      { label: "Standard Allowance", value: num(payslipData.standard_allowance) },
      { label: "Performance Bonus", value: num(payslipData.performance_bonus) },
      { label: "LTA", value: num(payslipData.lta) },
      { label: "Fixed Allowance", value: num(payslipData.fixed_allowance) },
    ];
    const deductions = [
      { label: "PF Employee", value: num(payslipData.pf_employee) },
      { label: "PF Employer", value: num(payslipData.pf_employer) },
      { label: "Professional Tax", value: num(payslipData.professional_tax) },
    ];
    const gross = earnings.reduce((s, r) => s + r.value, 0);
    const totalDeductions = deductions.reduce((s, r) => s + r.value, 0);
    return { earnings, deductions, gross, net: gross - totalDeductions };
  }

  // ===== Directory Helpers =====

  async function loadDirectory() {
    if (!session || role !== "admin") return;
    setDirectoryLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        user_id,
        full_name,
        job_position,
        department,
        profile_picture_url,
        phone,
        location,
        users!profiles_user_id_fkey (email, role)
      `)
      .eq("users.role", "employee");

    if (!error) {
      setDirectoryEmployees(data || []);
    }
    setDirectoryLoading(false);
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

  async function loadApprovedLeaves() {
    if (!session) return;
    const { start, end } = getMonthStartEnd(attendanceMonth);
    let query = supabase
      .from("leave_requests")
      .select("user_id, start_date, end_date, leave_type")
      .eq("status", "approved")
      .lte("start_date", end)
      .gte("end_date", start);
    if (role === "employee") {
      query = query.eq("user_id", session.user.id);
    }
    const { data, error } = await query;
    if (!error) setApprovedLeavesMonth(data || []);
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
    if (!error) {
      loadLeaveData();
      loadApprovedLeaves();
    }
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

  function renderLeaveCalendar() {
    const [year, mon] = attendanceMonth.split("-").map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const firstDay = new Date(year, mon - 1, 1).getDay();
    const cells: Array<{ day: number; dateStr: string } | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: `${attendanceMonth}-${String(d).padStart(2, "0")}` });
    }
    const todayStr = getLocalDateString();

    const onLeave = (dateStr: string) =>
      approvedLeavesMonth.some((l: any) => l.start_date <= dateStr && l.end_date >= dateStr);

    const attendanceByDate = new Map((attendanceList || []).map((r: any) => [r.date, r]));

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            if (!cell) return <div key={`empty-${idx}`} />;
            const dow = (firstDay + cell.day - 1) % 7;
            const isWeekend = dow === 0 || dow === 6;
            const isToday = cell.dateStr === todayStr;
            const att = attendanceByDate.get(cell.dateStr);
            return (
              <div
                key={cell.dateStr}
                className={`flex min-h-14 flex-col items-center rounded border p-1 ${isWeekend ? "bg-gray-50 opacity-60 dark:bg-gray-900" : ""} ${isToday ? "ring-2 ring-blue-400" : ""}`}
              >
                <span className="text-xs">{cell.day}</span>
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {onLeave(cell.dateStr) && (
                    <span title="Approved leave" className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                  {role === "employee" && att && (
                    <span
                      title={att.status}
                      className={`h-2 w-2 rounded-full ${getStatusDotClass(att.status)}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Approved leave</span>
          {role === "employee" && (
            <>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Present</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> Absent</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // ===== Announcements Helpers =====

  async function loadAnnouncements() {
    if (!session) return;
    setAnnouncementsLoading(true);
    setAnnouncementsError("");
    const { data, error } = await supabase
      .from("announcements")
      .select(`
        *,
        users!announcements_created_by_fkey (
          profiles!profiles_user_id_fkey (full_name)
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setAnnouncementsError(error.message);
    } else {
      setAnnouncements(data || []);
    }
    setAnnouncementsLoading(false);
  }

  async function createAnnouncement() {
    if (!session || role !== "admin") return;
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      setAnnouncementsError("Title and content are required.");
      return;
    }
    setAnnouncementSubmitting(true);
    setAnnouncementsError("");
    setAnnouncementSuccess("");

    const { error } = await supabase.from("announcements").insert({
      title: announcementForm.title.trim(),
      content: announcementForm.content.trim(),
      created_by: session.user.id,
    });

    if (error) {
      setAnnouncementsError(error.message);
    } else {
      setAnnouncementSuccess("Announcement published.");
      setAnnouncementForm({ title: "", content: "" });
      loadAnnouncements();
    }
    setAnnouncementSubmitting(false);
  }

  // ===== Documents Helpers =====

  async function loadDocuments(userId?: string) {
    if (!session) return;
    setDocumentsLoading(true);
    setDocumentsError("");

    let query = supabase
      .from("documents")
      .select(`
        *,
        users!documents_user_id_fkey (
          profiles!profiles_user_id_fkey (full_name)
        )
      `)
      .order("created_at", { ascending: false });

    if (role === "employee" || !userId) {
      query = query.eq("user_id", session.user.id);
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      setDocumentsError(error.message);
    } else {
      setDocuments(data || []);
    }
    setDocumentsLoading(false);
  }

  function handleDocumentsViewUserChange(userId: string) {
    setDocumentsViewUser(userId);
    loadDocuments(userId);
  }

  async function handleDocumentsUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!session || files.length === 0) return;

    setDocumentUploading(true);
    setDocumentMessage("");
    setDocumentsError("");

    let uploadedCount = 0;
    let lastError = "";

    for (const file of files) {
      const filePath = `${session.user.id}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        lastError = uploadError.message;
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: session.user.id,
        name: file.name,
        url: urlData.publicUrl,
      });

      if (dbError) {
        lastError = dbError.message;
      } else {
        uploadedCount += 1;
      }
    }

    if (uploadedCount > 0) {
      setDocumentMessage(`Uploaded ${uploadedCount} document(s).`);
      loadDocuments(role === "admin" ? documentsViewUser || session.user.id : session.user.id);
    }
    if (lastError) {
      setDocumentsError(lastError);
    }

    e.target.value = "";
    setDocumentUploading(false);
  }

  // ===== Dashboard Helpers =====

  async function loadDashboardData() {
    if (!session) return;
    setDashboardLoading(true);
    if (role === "employee") {
      const monthStart = getMonthStartEnd(attendanceMonth).start;

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

  const navItems: { key: NavKey; label: string; icon: ReactNode; adminOnly?: boolean }[] = [
    { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    { key: "attendance", label: "Attendance", icon: <CalendarCheck size={16} /> },
    { key: "leave", label: "Leave", icon: <CalendarDays size={16} /> },
    { key: "payslip", label: "Payslip", icon: <Wallet size={16} /> },
    { key: "announcements", label: "Announcements", icon: <Megaphone size={16} /> },
    { key: "documents", label: "Documents", icon: <FolderOpen size={16} /> },
    { key: "directory", label: "Directory", icon: <Users size={16} />, adminOnly: true },
    { key: "profile", label: "Profile", icon: <User size={16} /> },
    { key: "notifications", label: "Notifications", icon: <Bell size={16} /> },
  ];
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || role === "admin");

  // ================= RENDER =================

  if (authState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Skeleton className="h-8 w-32" />
      </main>
    );
  }

  if (authState === "login") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
          <h1 className="text-xl font-semibold">Sign in to Dayflow</h1>
          {sessionExpired && (
            <p className="text-sm rounded bg-yellow-100 p-2 text-yellow-800" role="alert">
              Your session has expired. Please sign in again.
            </p>
          )}
          {error && <ErrorMessage message={error} />}
          {success && <SuccessMessage message={success} />}
          <input
            className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="Email"
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />
          <input
            className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              className="text-left text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              className="text-left text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          {error && <ErrorMessage message={error} />}
          {success && <SuccessMessage message={success} />}
          {authState === "forgotPassword" && (
            <>
              <input className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="Email" type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} />
              <Button className="w-full" onClick={handleForgotPassword} disabled={loading}>{loading ? "Sending…" : "Send reset email"}</Button>
            </>
          )}
          {authState === "resendVerification" && (
            <>
              <input className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="Email" type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} />
              <Button className="w-full" onClick={handleResendVerification} disabled={loading}>{loading ? "Sending…" : "Resend verification"}</Button>
            </>
          )}
          {authState === "resetPassword" && (
            <>
              <input className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <input className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <Button className="w-full" onClick={handleResetPassword} disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
            </>
          )}
          {authState === "changePassword" && (
            <>
              <input className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <input className="w-full rounded border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <Button className="w-full" onClick={handlePasswordChange} disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
              <Button variant="outline" className="w-full" onClick={handleLogout}>Log out</Button>
            </>
          )}
          <Button variant="outline" className="w-full" onClick={() => setAuthState("login")}>Back to sign in</Button>
        </div>
      </main>
    );
  }

  // Authenticated view with sidebar navigation
  return (
    <main className="min-h-screen bg-background text-foreground md:flex">
      {/* Sidebar */}
      <aside className="flex shrink-0 flex-col border-b p-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center gap-3">
          <Avatar src={profileData?.profile_picture_url} name={profileData?.full_name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profileData?.full_name || "…"}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0" aria-label="Main navigation">
          {visibleNavItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveNav(item.key)}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                activeNav === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              aria-current={activeNav === item.key ? "page" : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.key === "notifications" && unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 text-xs text-white">{unreadCount}</span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-0 flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-gray-800 md:mt-auto"
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {/* DASHBOARD */}
          {activeNav === "dashboard" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{getGreeting()}</h2>

              {dashboardLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : role === "employee" && empDashboardData ? (
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
                      <Skeleton className="h-24" />
                    ) : adminDashboardData.length === 0 ? (
                      <EmptyState icon="👥" message="No employees found." />
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
                      <EmptyState icon="📝" message="No pending leave requests." />
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
                {checkInError && <ErrorMessage message={checkInError} />}
                {checkInMessage && <SuccessMessage message={checkInMessage} />}
                {checkOutError && <ErrorMessage message={checkOutError} />}
                {checkOutMessage && <SuccessMessage message={checkOutMessage} />}
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
                    <div className="space-y-2">
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                    </div>
                  ) : attendanceListError ? (
                    <ErrorMessage message={attendanceListError} />
                  ) : attendanceList.length === 0 ? (
                    <EmptyState icon="🗓️" message="No attendance records for this month." actionLabel="Check In" onAction={handleCheckIn} />
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
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Today's Attendance (All Employees)</h3>
                      {!confirmBulkAbsent ? (
                        <Button variant="outline" size="sm" onClick={() => setConfirmBulkAbsent(true)}>
                          Mark all absent who haven't checked in
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 rounded border p-2">
                          <span className="text-xs">Mark all missing employees as absent for today?</span>
                          <Button size="sm" onClick={bulkMarkAbsent} disabled={bulkAbsentLoading}>
                            {bulkAbsentLoading ? "Marking…" : "Confirm"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmBulkAbsent(false)} disabled={bulkAbsentLoading}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                    {bulkAbsentResult && <SuccessMessage message={bulkAbsentResult} />}
                    {bulkAbsentError && <ErrorMessage message={bulkAbsentError} />}
                    {adminLoading ? (
                      <Skeleton className="h-24" />
                    ) : adminError ? (
                      <ErrorMessage message={adminError} />
                    ) : adminTodayList.length === 0 ? (
                      <EmptyState icon="👥" message="No attendance records yet today." />
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
                    {adminLoading ? (
                      <Skeleton className="h-16" />
                    ) : adminMonthSummary ? (
                      <div className="flex flex-wrap gap-4">
                        {Object.entries(adminMonthSummary as Record<string, number>).map(([status, count]: [string, number]) => (
                          <div key={status} className="flex items-center gap-2">
                            <Badge className={getStatusBadgeClass(status)}>{status}</Badge>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon="📊" message="No summary available for this month." />
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowChangePassword((v) => !v);
                        setCpError("");
                        setCpSuccess("");
                      }}
                    >
                      <KeyRound size={14} className="mr-1" />
                      Change Password
                    </Button>
                    {!editMode ? (
                      <Button variant="outline" size="sm" onClick={startEditProfile}>Edit Profile</Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={cancelEditProfile}>Cancel</Button>
                        <Button size="sm" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? "Saving…" : "Save"}</Button>
                      </>
                    )}
                  </div>
                </div>

                {showChangePassword && (
                  <div className="mb-4 space-y-2 rounded border p-3">
                    <h3 className="text-sm font-semibold">Change Password</h3>
                    <Input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    <Input type="password" placeholder="New password" value={cpNewPassword} onChange={(e) => setCpNewPassword(e.target.value)} />
                    <Input type="password" placeholder="Confirm new password" value={cpConfirmPassword} onChange={(e) => setCpConfirmPassword(e.target.value)} />
                    {cpError && <ErrorMessage message={cpError} />}
                    {cpSuccess && <SuccessMessage message={cpSuccess} />}
                    <Button size="sm" onClick={handleChangePasswordSubmit} disabled={cpLoading}>
                      {cpLoading ? "Updating…" : "Update Password"}
                    </Button>
                  </div>
                )}

                {profileError && <ErrorMessage message={profileError} />}
                {profileSuccess && <SuccessMessage message={profileSuccess} />}

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
                    <div className="flex items-center gap-4">
                      <Avatar src={avatarPreview || profileForm.profile_picture_url} name={profileForm.full_name || profileData?.full_name} size="lg" />
                      <div className="space-y-1">
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarSelect}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={avatarUploading}
                        >
                          <Upload size={14} className="mr-1" />
                          {avatarUploading ? "Uploading…" : "Upload Picture"}
                        </Button>
                        <p className="text-xs text-muted-foreground">PNG or JPG. Saved instantly.</p>
                      </div>
                    </div>
                    {role === "admin" ? (
                      <>
                        <Input name="full_name" placeholder="Full Name" value={profileForm.full_name} onChange={handleProfileInputChange} />
                        <Input name="phone" placeholder="Phone" value={profileForm.phone} onChange={handleProfileInputChange} />
                        <Input name="address" placeholder="Address" value={profileForm.address} onChange={handleProfileInputChange} />
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
                    {salaryError && <ErrorMessage message={salaryError} />}
                    {salarySuccess && <SuccessMessage message={salarySuccess} />}
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
                  <select className="border rounded px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" value={leaveForm.leave_type} onChange={(e) => setLeaveForm({...leaveForm, leave_type: e.target.value})}>
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
                {leaveError && <ErrorMessage message={leaveError} />}
                {leaveSuccess && <SuccessMessage message={leaveSuccess} />}
              </Card>

              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Leave Calendar — {monthLabel(attendanceMonth)}</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}>←</Button>
                    <Button variant="outline" size="sm" onClick={() => changeMonth(1)}>→</Button>
                  </div>
                </div>
                {renderLeaveCalendar()}
              </Card>

              <Card className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Leave List</h3>
                {leaveList.length === 0 ? (
                  <EmptyState icon="📋" message="No leave requests yet." actionLabel="Apply for Leave" onAction={() => setActiveNav("leave")} />
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

          {/* PAYSLIP */}
          {activeNav === "payslip" && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Payslip</h2>
                  <div className="flex items-center gap-2">
                    {role === "admin" && (
                      <select
                        className="rounded border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        value={payslipSelectedUser}
                        onChange={(e) => handlePayslipUserChange(e.target.value)}
                      >
                        <option value="">Select employee…</option>
                        {directoryEmployees.map((emp: any) => (
                          <option key={emp.user_id} value={emp.user_id}>
                            {emp.full_name}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.print()}
                      disabled={!payslipData}
                    >
                      <Download size={14} className="mr-1" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                {payslipLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : payslipError ? (
                  <EmptyState icon="💰" message={payslipError} />
                ) : !payslipData ? (
                  <EmptyState icon="💰" message={role === "admin" ? "Select an employee to view their payslip." : "No payslip available yet."} />
                ) : (
                  (() => {
                    const { earnings, deductions, gross, net } = payslipRows();
                    return (
                      <div className="space-y-4">
                        <div className="rounded border p-3">
                          <p className="text-base font-semibold">{payslipEmployee?.full_name || "Employee"}</p>
                          <p className="text-xs text-muted-foreground">
                            {payslipEmployee?.job_position || "—"} · {payslipEmployee?.department || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">Payslip generated on {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <h3 className="mb-2 text-sm font-semibold">Earnings</h3>
                            <div className="space-y-1 text-sm">
                              {earnings.map((row) => (
                                <div key={row.label} className="flex justify-between border-b pb-1">
                                  <span>{row.label}</span>
                                  <span>{formatCurrency(row.value)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between pt-1 font-semibold">
                                <span>Gross Earnings</span>
                                <span>{formatCurrency(gross)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h3 className="mb-2 text-sm font-semibold">Deductions</h3>
                            <div className="space-y-1 text-sm">
                              {deductions.map((row) => (
                                <div key={row.label} className="flex justify-between border-b pb-1">
                                  <span>{row.label}</span>
                                  <span>{formatCurrency(row.value)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between pt-1 font-semibold">
                                <span>Total Deductions</span>
                                <span>{formatCurrency(deductions.reduce((s, r) => s + r.value, 0))}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between rounded bg-primary/10 p-3 text-base font-bold">
                          <span>Net Pay</span>
                          <span>{formatCurrency(net)}</span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </Card>
            </div>
          )}

          {/* DIRECTORY (admin only) */}
          {activeNav === "directory" && role === "admin" && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Employee Directory</h2>
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
                    <Input
                      className="pl-7"
                      placeholder="Search by name or department…"
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                    />
                  </div>
                </div>
                {directoryLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : (() => {
                  const q = directorySearch.toLowerCase();
                  const filtered = directoryEmployees.filter(
                    (emp: any) =>
                      (emp.full_name || "").toLowerCase().includes(q) ||
                      (emp.department || "").toLowerCase().includes(q)
                  );
                  if (filtered.length === 0) {
                    return <EmptyState icon="👥" message="No employees found." />;
                  }
                  return (
                    <div className="space-y-2">
                      {filtered.map((emp: any) => (
                        <button
                          key={emp.user_id}
                          type="button"
                          onClick={() => setDirectorySelected(emp)}
                          className="flex w-full items-center gap-3 rounded border p-2 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-gray-900"
                        >
                          <Avatar src={emp.profile_picture_url} name={emp.full_name} size="md" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{emp.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {emp.job_position || "—"} · {emp.department || "No department"}
                            </p>
                          </div>
                          <span className="ml-auto hidden truncate text-xs text-muted-foreground sm:block">{emp.users?.email}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </Card>

              {directorySelected && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  role="dialog"
                  aria-modal="true"
                  onClick={() => setDirectorySelected(null)}
                >
                  <div
                    className="w-full max-w-md space-y-3 rounded-lg border bg-background p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar src={directorySelected.profile_picture_url} name={directorySelected.full_name} size="lg" />
                        <div>
                          <p className="text-base font-semibold">{directorySelected.full_name}</p>
                          <p className="text-xs text-muted-foreground">{directorySelected.job_position || "—"}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setDirectorySelected(null)} aria-label="Close">
                        <X size={14} />
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Department:</span> {directorySelected.department || "—"}</p>
                      <p><span className="font-medium">Email:</span> {directorySelected.users?.email || "—"}</p>
                      <p><span className="font-medium">Phone:</span> {directorySelected.phone || "—"}</p>
                      <p><span className="font-medium">Location:</span> {directorySelected.location || "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANNOUNCEMENTS */}
          {activeNav === "announcements" && (
            <div className="space-y-4">
              {role === "admin" && (
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-semibold">Post Announcement</h3>
                  <div className="space-y-2">
                    <Input placeholder="Title" value={announcementForm.title} onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})} />
                    <textarea
                      className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      rows={4}
                      placeholder="Content…"
                      value={announcementForm.content}
                      onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                    />
                    <Button onClick={createAnnouncement} disabled={announcementSubmitting}>
                      {announcementSubmitting ? "Publishing…" : "Publish"}
                    </Button>
                    {announcementSuccess && <SuccessMessage message={announcementSuccess} />}
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <h3 className="mb-3 text-sm font-semibold">Announcements</h3>
                {announcementsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : announcementsError ? (
                  <ErrorMessage message={announcementsError} />
                ) : announcements.length === 0 ? (
                  <EmptyState icon="📢" message="No announcements yet." />
                ) : (
                  <div className="space-y-2">
                    {announcements.map((a: any) => (
                      <div key={a.id} className="rounded border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{a.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{a.content}</p>
                        {a.users?.profiles?.full_name && (
                          <p className="mt-1 text-xs text-muted-foreground">Posted by {a.users.profiles.full_name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* DOCUMENTS */}
          {activeNav === "documents" && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Documents</h2>
                  {role === "admin" && (
                    <select
                      className="rounded border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={documentsViewUser}
                      onChange={(e) => handleDocumentsViewUserChange(e.target.value)}
                    >
                      <option value="">My documents</option>
                      {directoryEmployees.map((emp: any) => (
                        <option key={emp.user_id} value={emp.user_id}>{emp.full_name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="mb-3">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    id="documents-upload"
                    onChange={handleDocumentsUpload}
                  />
                  <label htmlFor="documents-upload">
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900">
                      <Upload size={14} />
                      {documentUploading ? "Uploading…" : "Upload Documents"}
                    </span>
                  </label>
                  {documentMessage && <p className="mt-2"><SuccessMessage message={documentMessage} /></p>}
                  {documentsError && <p className="mt-2"><ErrorMessage message={documentsError} /></p>}
                </div>

                {documentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : documents.length === 0 ? (
                  <EmptyState icon="📁" message="No documents uploaded yet." />
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between rounded border p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString()}
                            {role === "admin" && doc.users?.profiles?.full_name ? ` · ${doc.users.profiles.full_name}` : ""}
                          </p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                        >
                          <Download size={14} />
                          Open
                        </a>
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
                <div className="space-y-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState icon="🔔" message="You're all caught up!" />
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
        </div>
      </div>
    </main>
  );
}
