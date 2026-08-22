import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables on server");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let pwd = "";
  const random = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    pwd += chars[random[i] % chars.length];
  }
  // Ensure it includes at least one uppercase, one lowercase, one digit, one special
  return "Aa1!" + pwd.slice(4);
}

app.post("/api/admin/users", async (req, res) => {
  try {
    // 1. Verify admin auth from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }
    const token = authHeader.split(" ")[1];

    // 2. Get the current user from token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 3. Check role in public.users
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (adminError || !adminData || adminData.role !== "admin") {
      return res.status(403).json({ error: "Only admins can create employees" });
    }

    // 4. Validate required fields
    const {
      first_name,
      last_name,
      email,
      company_prefix,
      joining_year,
      employee_code = null,
      department = null,
      job_position = null,
      phone = null,
      date_of_joining = null
    } = req.body;

    if (!first_name || !last_name || !email || !company_prefix || !joining_year) {
      return res.status(400).json({
        error: "first_name, last_name, email, company_prefix, joining_year are required"
      });
    }

    // 5. Generate login ID using SQL function
    const { data: loginIdData, error: loginIdError } = await supabaseAdmin.rpc(
      "generate_login_id",
      {
        p_company_prefix: company_prefix,
        p_first_name: first_name,
        p_last_name: last_name,
        p_joining_year: joining_year
      }
    );

    if (loginIdError) {
      return res.status(400).json({ error: loginIdError.message });
    }

    const login_id = loginIdData;

    // 6. Create auth user with temporary password
    const tempPassword = generateTempPassword();

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { login_id }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const newUserId = authData.user.id;

    // 7. Insert into public.users
    const { error: usersInsertError } = await supabaseAdmin
      .from("users")
      .insert({
        id: newUserId,
        login_id,
        email,
        role: "employee",
        employee_code,
        joining_year,
        must_change_password: true
      });

    if (usersInsertError) {
      // Rollback auth user if insert fails
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return res.status(400).json({ error: usersInsertError.message });
    }

    // 8. Insert into public.profiles
    const { error: profilesInsertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: newUserId,
        full_name: `${first_name} ${last_name}`,
        phone,
        department,
        job_position,
        date_of_joining: date_of_joining || new Date().toISOString().slice(0, 10)
      });

    if (profilesInsertError) {
      // Clean up partial data
      await supabaseAdmin.from("users").delete().eq("id", newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return res.status(400).json({ error: profilesInsertError.message });
    }

    // 9. Return success
    return res.status(201).json({
      user_id: newUserId,
      login_id,
      temp_password: tempPassword,
      email
    });
  } catch (err) {
    console.error("Create employee error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Admin API running on http://localhost:${PORT}`);
});