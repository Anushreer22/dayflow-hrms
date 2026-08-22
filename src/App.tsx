import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    company_prefix: "OIJ",
    joining_year: new Date().getFullYear(),
    employee_code: "",
    department: "",
    job_position: "",
    phone: ""
  });
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setSession(data.session);
  }

  async function handleCreateEmployee() {
    setError("");
    setResult("");
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      setError("No admin session");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentSession.access_token}`,
      },
      body: JSON.stringify({
        ...form,
        joining_year: parseInt(form.joining_year, 10)
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create employee");
      return;
    }
    setResult(`Created employee: ${data.login_id} with temporary password: ${data.temp_password}`);
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
          <h1 className="text-xl font-semibold">Admin Login (Test Harness)</h1>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Admin email"
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
          <Button className="w-full" onClick={handleLogin}>Login</Button>
          {error && <p className="text-red-500">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-lg space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Create Employee (Admin)</h1>
        {result && <p className="text-green-600">{result}</p>}
        {error && <p className="text-red-500">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <input className="rounded border px-3 py-2" placeholder="First name" value={form.first_name} onChange={(e) => setForm({...form, first_name: e.target.value})} />
          <input className="rounded border px-3 py-2" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({...form, last_name: e.target.value})} />
          <input className="rounded border px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
          <input className="rounded border px-3 py-2" placeholder="Company prefix" value={form.company_prefix} onChange={(e) => setForm({...form, company_prefix: e.target.value})} />
          <input className="rounded border px-3 py-2" placeholder="Joining year" value={form.joining_year} onChange={(e) => setForm({...form, joining_year: e.target.value})} />
          <input className="rounded border px-3 py-2" placeholder="Employee code (optional)" value={form.employee_code} onChange={(e) => setForm({...form, employee_code: e.target.value})} />
          <input className="rounded border px-3 py-2" placeholder="Department" value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} />
          <input className="rounded border px-3 py-2" placeholder="Job position" value={form.job_position} onChange={(e) => setForm({...form, job_position: e.target.value})} />
          <input className="rounded border px-3 py-2" placeholder="Phone" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
        </div>
        <Button className="w-full" onClick={handleCreateEmployee}>Create Employee</Button>
        <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); setSession(null); }}>Logout</Button>
      </div>
    </main>
  );
}