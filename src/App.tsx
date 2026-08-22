import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusBadgeClass } from "@/lib/status";
import {
  PAID_LEAVE_ANNUAL_DAYS,
  SICK_LEAVE_ANNUAL_DAYS,
  LEAVE_ATTACHMENTS_BUCKET,
  LEAVE_TYPE_LABELS,
  formatLeaveDays,
  inclusiveLeaveDays,
  datesOverlap,
} from "@/lib/leave";

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
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryError, setSalaryError] = useState("");
  const [salarySuccess, setSalarySuccess] = useState("");
  const [salaryPreview, setSalaryPreview] = useState<any>(null);

  // Leave balance states (employee Time Off)
  const [paidLeaveUsed, setPaidLeaveUsed] = useState(0);
  const [sickLeaveUsed, setSickLeaveUsed] = useState(0);
  const [leaveBalanceLoading, setLeaveBalanceLoading] = useState(false);
  const [leaveBalanceError, setLeaveBalanceError] = useState("");
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: "paid",
    start_date: "",
    end_date: "",
    allocation_days: "",
  });
  const [leaveAttachmentFile, setLeaveAttachmentFile] = useState<File | null>(null);
  const [leaveFormErrors, setLeaveFormErrors] = useState<Record<string, string>>({});
  const [employeeLeaveRequests, setEmployeeLeaveRequests] = useState<any[]>([]);
  const [leaveToast, setLeaveToast] = useState("");

  const manualLogoutRef = useRef(false);
  const leaveToastTimerRef = useRef<number | null>(null);

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

  // Load profile data on authentication
  useEffect(() => {
    if (authState === "authenticated" && session) {
      loadProfile();
      loadSalary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, session]);

  // Load leave balances (employee Time Off)
  useEffect(() => {
    if (authState === "authenticated" && session && role === "employee") {
      loadLeaveBalances();
      loadEmployeeLeaveRequests();
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

  // ===== Salary Helpers =====

  function formatMoney(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === "") return "—";
    const num = Number(value);
    if (Number.isNaN(num)) return "—";
    return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderSalaryComponents(row: any) {
    if (!row) return null;
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <p><span className="font-medium">Basic:</span> {formatMoney(row.basic)}</p>
        <p><span className="font-medium">HRA:</span> {formatMoney(row.hra)}</p>
        <p><span className="font-medium">Standard allowance:</span> {formatMoney(row.standard_allowance)}</p>
        <p><span className="font-medium">Performance bonus:</span> {formatMoney(row.performance_bonus)}</p>
        <p><span className="font-medium">LTA:</span> {formatMoney(row.lta)}</p>
        <p><span className="font-medium">Fixed allowance:</span> {formatMoney(row.fixed_allowance)}</p>
        <p><span className="font-medium">PF (employee):</span> {formatMoney(row.pf_employee)}</p>
        <p><span className="font-medium">PF (employer):</span> {formatMoney(row.pf_employer)}</p>
        <p><span className="font-medium">Professional tax:</span> {formatMoney(row.professional_tax)}</p>
      </div>
    );
  }

  async function loadSalary() {
    if (!session) return;
    const { data, error } = await supabase
      .from("salary_structures")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      setSalaryError(error.message);
      return;
    }

    setSalaryData(data);
    if (data) {
      setSalaryForm({
        wage_monthly: String(data.wage_monthly ?? ""),
        effective_from: data.effective_from || "",
      });
    }
  }

  function handleSalaryInputChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setSalaryForm((prev) => ({ ...prev, [name]: value }));
    setSalaryPreview(null);
    setSalaryError("");
    setSalarySuccess("");
  }

  async function calculateSalaryPreview(wage?: number) {
    setSalaryError("");
    setSalarySuccess("");
    const wageValue = wage ?? Number(salaryForm.wage_monthly);
    if (!wageValue || Number.isNaN(wageValue) || wageValue <= 0) {
      setSalaryError("Enter a valid monthly wage to preview.");
      return;
    }
    const effectiveFrom = salaryForm.effective_from || new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase.rpc("calculate_salary_components", {
      wage: wageValue,
      effective_from: effectiveFrom,
    });

    if (error) {
      setSalaryError(error.message);
      setSalaryPreview(null);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    setSalaryPreview(row || null);
  }

  async function saveSalary() {
    if (!session || role !== "admin") {
      setSalaryError("Only admins can update salary structures.");
      return;
    }

    const wageValue = Number(salaryForm.wage_monthly);
    if (!wageValue || Number.isNaN(wageValue) || wageValue <= 0) {
      setSalaryError("Enter a valid monthly wage.");
      return;
    }
    if (!salaryForm.effective_from) {
      setSalaryError("Effective from date is required.");
      return;
    }

    setSalarySaving(true);
    setSalaryError("");
    setSalarySuccess("");

    const payload = {
      user_id: session.user.id,
      wage_monthly: wageValue,
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
      setSalaryData(data);
      setSalaryPreview(null);
      setSalarySuccess("Salary structure saved. Components were recalculated automatically.");
      await loadSalary();
    }
    setSalarySaving(false);
  }

  function renderSalaryTabContent() {
    if (role === "admin") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter monthly wage and effective date. Components are calculated automatically and cannot be edited by hand.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="wage_monthly">Monthly wage</label>
            <Input
              id="wage_monthly"
              name="wage_monthly"
              type="number"
              step="0.01"
              placeholder="Monthly wage"
              value={salaryForm.wage_monthly}
              onChange={handleSalaryInputChange}
            />
            <label className="text-sm font-medium" htmlFor="effective_from">Effective from</label>
            <Input
              id="effective_from"
              name="effective_from"
              type="date"
              value={salaryForm.effective_from}
              onChange={handleSalaryInputChange}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => calculateSalaryPreview()}
              >
                Calculate Preview
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={saveSalary}
                disabled={salarySaving}
              >
                {salarySaving ? "Saving…" : "Save salary"}
              </Button>
            </div>
          </div>
          {salaryError && <p className="text-sm text-red-500">{salaryError}</p>}
          {salarySuccess && <p className="text-sm text-green-600">{salarySuccess}</p>}
          {salaryPreview && (
            <div className="space-y-2 rounded border p-3">
              <p className="text-sm font-medium">Preview (not saved yet)</p>
              {renderSalaryComponents(salaryPreview)}
            </div>
          )}
          {salaryData && (
            <div className="space-y-2 rounded border p-3">
              <p className="text-sm font-medium">Saved structure</p>
              <p className="text-sm">
                <span className="font-medium">Monthly wage:</span> {formatMoney(salaryData.wage_monthly)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Effective from:</span> {salaryData.effective_from || "—"}
              </p>
              {renderSalaryComponents(salaryData)}
            </div>
          )}
        </div>
      );
    }

    if (!salaryData) {
      return <p className="text-sm text-muted-foreground">No salary structure on file.</p>;
    }

    return (
      <div className="space-y-2">
        <p className="text-sm">
          <span className="font-medium">Monthly wage:</span> {formatMoney(salaryData.wage_monthly)}
        </p>
        <p className="text-sm">
          <span className="font-medium">Effective from:</span> {salaryData.effective_from || "—"}
        </p>
        {renderSalaryComponents(salaryData)}
      </div>
    );
  }

  async function loadLeaveBalances() {
    if (!session) return;
    setLeaveBalanceLoading(true);
    setLeaveBalanceError("");

    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const { data, error } = await supabase
      .from("leave_requests")
      .select("leave_type, allocation_days")
      .eq("user_id", session.user.id)
      .eq("status", "approved")
      .gte("start_date", yearStart)
      .lte("start_date", yearEnd);

    if (error) {
      setLeaveBalanceError(error.message);
      setLeaveBalanceLoading(false);
      return;
    }

    let paidUsed = 0;
    let sickUsed = 0;
    (data || []).forEach((row: { leave_type: string; allocation_days: number | string }) => {
      const days = Number(row.allocation_days) || 0;
      if (row.leave_type === "paid") paidUsed += days;
      if (row.leave_type === "sick") sickUsed += days;
    });

    setPaidLeaveUsed(paidUsed);
    setSickLeaveUsed(sickUsed);
    setLeaveBalanceLoading(false);
  }

  async function loadEmployeeLeaveRequests() {
    if (!session) return;
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, allocation_days, status, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setEmployeeLeaveRequests(data || []);
    }
  }

  function showLeaveToast(message: string) {
    setLeaveToast(message);
    if (leaveToastTimerRef.current) {
      window.clearTimeout(leaveToastTimerRef.current);
    }
    leaveToastTimerRef.current = window.setTimeout(() => {
      setLeaveToast("");
      leaveToastTimerRef.current = null;
    }, 4000);
  }

  function resetLeaveForm() {
    setLeaveForm({
      leave_type: "paid",
      start_date: "",
      end_date: "",
      allocation_days: "",
    });
    setLeaveAttachmentFile(null);
    setLeaveFormErrors({});
  }

  function openLeaveModal() {
    resetLeaveForm();
    setLeaveModalOpen(true);
  }

  function discardLeaveModal() {
    if (leaveSubmitting) return;
    setLeaveModalOpen(false);
    resetLeaveForm();
  }

  function handleLeaveFormChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setLeaveForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "start_date" || name === "end_date") {
        const days = inclusiveLeaveDays(
          name === "start_date" ? value : prev.start_date,
          name === "end_date" ? value : prev.end_date
        );
        if (days !== null) {
          next.allocation_days = String(days);
        }
      }
      return next;
    });
    setLeaveFormErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      delete next.dates;
      delete next.overlap;
      if (name === "leave_type") delete next.attachment;
      return next;
    });
  }

  function handleLeaveAttachmentChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setLeaveAttachmentFile(file);
    setLeaveFormErrors((prev) => {
      const next = { ...prev };
      delete next.attachment;
      return next;
    });
  }

  async function submitLeaveRequest() {
    if (!session || leaveSubmitting) return;
    setLeaveSubmitting(true);
    setLeaveFormErrors({});

    const errors: Record<string, string> = {};
    const { leave_type, start_date, end_date, allocation_days } = leaveForm;

    if (!start_date) errors.start_date = "Start date is required.";
    if (!end_date) errors.end_date = "End date is required.";
    if (start_date && end_date && end_date < start_date) {
      errors.dates = "End date must not be before start date.";
    }

    const allocation = Number(allocation_days);
    if (!allocation_days || Number.isNaN(allocation) || allocation <= 0) {
      errors.allocation_days = "Allocation must be a number greater than 0.";
    }

    if (leave_type === "sick" && !leaveAttachmentFile) {
      errors.attachment = "An attachment is required for Sick Leave.";
    }

    if (Object.keys(errors).length > 0) {
      setLeaveFormErrors(errors);
      setLeaveSubmitting(false);
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status")
      .eq("user_id", session.user.id)
      .in("status", ["pending", "approved"]);

    if (existingError) {
      setLeaveFormErrors({ submit: existingError.message });
      setLeaveSubmitting(false);
      return;
    }

    const hasOverlap = (existing || []).some((row: { start_date: string; end_date: string }) =>
      datesOverlap(start_date, end_date, row.start_date, row.end_date)
    );
    if (hasOverlap) {
      setLeaveFormErrors({
        overlap: "This date range overlaps an existing pending or approved leave request.",
      });
      setLeaveSubmitting(false);
      return;
    }

    let attachmentUrl: string | null = null;
    if (leaveAttachmentFile) {
      const safeName = leaveAttachmentFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(LEAVE_ATTACHMENTS_BUCKET)
        .upload(path, leaveAttachmentFile);

      if (uploadError) {
        setLeaveFormErrors({
          attachment: `Could not upload attachment: ${uploadError.message}. If this persists, run supabase/leave_storage.sql in the SQL editor.`,
        });
        setLeaveSubmitting(false);
        return;
      }

      const { data: publicData } = supabase.storage
        .from(LEAVE_ATTACHMENTS_BUCKET)
        .getPublicUrl(path);
      attachmentUrl = publicData.publicUrl;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("leave_requests")
      .insert({
        user_id: session.user.id,
        leave_type,
        start_date,
        end_date,
        allocation_days: allocation,
        attachment_url: attachmentUrl,
      })
      .select("id, leave_type, start_date, end_date, allocation_days, status, created_at")
      .single();

    if (insertError) {
      setLeaveFormErrors({ submit: insertError.message });
      setLeaveSubmitting(false);
      return;
    }

    setEmployeeLeaveRequests((prev) => [inserted, ...prev.filter((r) => r.id !== inserted.id)]);
    await loadLeaveBalances();
    setLeaveSubmitting(false);
    setLeaveModalOpen(false);
    resetLeaveForm();
    showLeaveToast("Leave request submitted. Status: Pending");
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
        return renderSalaryTabContent();
      default:
        return null;
    }
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
        {/* Attendance card */}
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

        {/* Profile card */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Profile</h2>
            {!editMode ? (
              <Button variant="outline" size="sm" onClick={startEditProfile}>
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEditProfile}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>

          {profileError && <p className="text-sm text-red-500">{profileError}</p>}
          {profileSuccess && <p className="text-sm text-green-600">{profileSuccess}</p>}

          {/* Tabs */}
          <div className="mb-3 flex flex-wrap gap-1">
            {[
              { key: "myProfile", label: "My Profile" },
              { key: "resume", label: "Resume" },
              { key: "privateInfo", label: "Private Info" },
              { key: "skills", label: "Skills" },
              { key: "about", label: "About" },
              { key: "salary", label: "Salary Info" },
            ].map((tab) => (
              <Button
                key={tab.key}
                variant={activeProfileTab === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveProfileTab(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {activeProfileTab === "salary" ? (
            renderSalaryTabContent()
          ) : editMode ? (
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

        {/* Salary summary */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Salary</h2>
          {salaryData ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Monthly wage:</span> {formatMoney(salaryData.wage_monthly)}
              </p>
              <p>
                <span className="font-medium">Basic:</span> {formatMoney(salaryData.basic)}
              </p>
              <p>
                <span className="font-medium">Effective from:</span> {salaryData.effective_from || "—"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No salary structure on file.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Details are in Profile &gt; Salary Info.
          </p>
        </Card>

        {/* Employee Time Off balances */}
        {role === "employee" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Time Off</h2>
              <Button size="sm" onClick={openLeaveModal}>
                Apply for Leave
              </Button>
            </div>
            {leaveBalanceError && (
              <p className="text-sm text-red-500">{leaveBalanceError}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Paid Time Off</p>
                  <Badge className={getStatusBadgeClass("leave")}>Paid</Badge>
                </div>
                {leaveBalanceLoading ? (
                  <p className="text-sm text-muted-foreground">Loading balance…</p>
                ) : (
                  <>
                    <p className="text-sm">
                      Paid Time Off — {formatLeaveDays(Math.max(0, PAID_LEAVE_ANNUAL_DAYS - paidLeaveUsed))} days available
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatLeaveDays(paidLeaveUsed)} of {PAID_LEAVE_ANNUAL_DAYS} days used this year
                    </p>
                  </>
                )}
              </Card>
              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Sick Time Off</p>
                  <Badge className={getStatusBadgeClass("pending")}>Sick</Badge>
                </div>
                {leaveBalanceLoading ? (
                  <p className="text-sm text-muted-foreground">Loading balance…</p>
                ) : (
                  <>
                    <p className="text-sm">
                      Sick Time Off — {formatLeaveDays(Math.max(0, SICK_LEAVE_ANNUAL_DAYS - sickLeaveUsed))} days available
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatLeaveDays(sickLeaveUsed)} of {SICK_LEAVE_ANNUAL_DAYS} days used this year
                    </p>
                  </>
                )}
              </Card>
            </div>
            {employeeLeaveRequests.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-medium">Submitted requests</h3>
                <div className="space-y-2">
                  {employeeLeaveRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <p className="text-sm font-medium">
                          {LEAVE_TYPE_LABELS[req.leave_type] || req.leave_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {req.start_date} → {req.end_date}
                        </p>
                      </div>
                      <Badge className={getStatusBadgeClass(req.status)}>
                        {req.status === "pending" ? "Pending" : req.status === "approved" ? "Approved" : req.status === "rejected" ? "Rejected" : req.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

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
                  {Object.entries(adminMonthSummary).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-2">
                      <Badge className={getStatusBadgeClass(status)}>
                        {status}
                      </Badge>
                      <span className="text-sm font-medium">{String(count)}</span>
                    </div>
                  ))}
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

        {/* Logout */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Account</h2>
          <Button variant="outline" onClick={handleLogout}>Log out</Button>
        </Card>
      </div>

      {leaveToast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg border bg-green-50 px-4 py-2 text-sm text-green-800 shadow">
          {leaveToast}
        </div>
      )}

      {leaveModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md p-4">
            <h2 className="mb-3 text-sm font-semibold">Apply for Leave</h2>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm font-medium">Employee</p>
                <Input
                  readOnly
                  value={profileData?.full_name || session?.user?.email || ""}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="leave_type">Time Off Type</label>
                <select
                  id="leave_type"
                  name="leave_type"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  value={leaveForm.leave_type}
                  onChange={handleLeaveFormChange}
                  disabled={leaveSubmitting}
                >
                  <option value="paid">Paid Time Off</option>
                  <option value="sick">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="start_date">Start date</label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={leaveForm.start_date}
                    onChange={handleLeaveFormChange}
                    disabled={leaveSubmitting}
                  />
                  {leaveFormErrors.start_date && (
                    <p className="mt-1 text-xs text-red-500">{leaveFormErrors.start_date}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="end_date">End date</label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={leaveForm.end_date}
                    onChange={handleLeaveFormChange}
                    disabled={leaveSubmitting}
                  />
                  {leaveFormErrors.end_date && (
                    <p className="mt-1 text-xs text-red-500">{leaveFormErrors.end_date}</p>
                  )}
                </div>
              </div>
              {leaveFormErrors.dates && (
                <p className="text-xs text-red-500">{leaveFormErrors.dates}</p>
              )}
              {leaveFormErrors.overlap && (
                <p className="text-xs text-red-500">{leaveFormErrors.overlap}</p>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="allocation_days">Allocation (days)</label>
                <Input
                  id="allocation_days"
                  name="allocation_days"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={leaveForm.allocation_days}
                  onChange={handleLeaveFormChange}
                  disabled={leaveSubmitting}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-filled from the date range (inclusive). Edit for half-days.
                </p>
                {leaveFormErrors.allocation_days && (
                  <p className="mt-1 text-xs text-red-500">{leaveFormErrors.allocation_days}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="leave_attachment">
                  Attachment {leaveForm.leave_type === "sick" ? "(required for Sick Leave)" : "(optional)"}
                </label>
                <input
                  id="leave_attachment"
                  key={leaveModalOpen ? "leave-file" : "leave-file-closed"}
                  type="file"
                  className="block w-full text-sm"
                  onChange={handleLeaveAttachmentChange}
                  disabled={leaveSubmitting}
                />
                {leaveFormErrors.attachment && (
                  <p className="mt-1 text-xs text-red-500">{leaveFormErrors.attachment}</p>
                )}
              </div>
              {leaveFormErrors.submit && (
                <p className="text-xs text-red-500">{leaveFormErrors.submit}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={discardLeaveModal}
                  disabled={leaveSubmitting}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  onClick={submitLeaveRequest}
                  disabled={leaveSubmitting}
                >
                  {leaveSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Submitting…
                    </span>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}