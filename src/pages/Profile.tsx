import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type UserData = {
  email: string;
  login_id: string;
  employee_code: string | null;
  role: "admin" | "employee";
};

type ProfileData = {
  full_name: string;
  phone: string | null;
  address: string | null;
  profile_picture_url: string | null;
  job_position: string | null;
  department: string | null;
  date_of_joining: string;
};

export default function Profile() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      setLoading(true);
      setError("");

      // 1. Get currently logged-in user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error("No logged-in user found.");
      }

      // 2. Get data from users table
      const { data: userInfo, error: userError } = await supabase
        .from("users")
        .select("email, login_id, employee_code, role")
        .eq("id", user.id)
        .single();

      if (userError) {
        throw userError;
      }

      // 3. Get data from profiles table
      const { data: profileInfo, error: profileError } = await supabase
        .from("profiles")
        .select(
          `
          full_name,
          phone,
          address,
          profile_picture_url,
          job_position,
          department,
          date_of_joining
          `
        )
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      // 4. Store the data
      setUserData(userInfo);
      setProfile(profileInfo);
    } catch (err) {
      console.error("Profile loading error:", err);
      setError("Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />

          <Card className="p-6">
            <div className="space-y-6">
              <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-muted" />

              <div className="mx-auto h-6 w-48 animate-pulse rounded bg-muted" />

              <div className="grid gap-5 md:grid-cols-2">
                <div className="h-16 animate-pulse rounded bg-muted" />
                <div className="h-16 animate-pulse rounded bg-muted" />
                <div className="h-16 animate-pulse rounded bg-muted" />
                <div className="h-16 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-destructive">{error}</p>
      </main>
    );
  }

  if (!userData || !profile) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Page heading */}
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">
            View your personal and job information
          </p>
        </div>

        {/* Main profile card */}
        <Card className="p-6">

          {/* Profile picture */}
          <div className="flex flex-col items-center gap-3 border-b pb-6">
            {profile.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt={profile.full_name}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            )}

            <h2 className="text-2xl font-semibold">
              {profile.full_name}
            </h2>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {userData.login_id}
              </span>

              <Badge>
                {userData.role === "admin" ? "Admin" : "Employee"}
              </Badge>
            </div>
          </div>

          {/* Personal Information */}
          <section className="mt-6">
            <h3 className="mb-4 text-lg font-semibold">
              Personal Information
            </h3>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <p className="text-sm text-muted-foreground">
                  Email
                </p>
                <p className="font-medium">
                  {userData.email}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Phone
                </p>
                <p className="font-medium">
                  {profile.phone || "Not provided"}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">
                  Address
                </p>
                <p className="font-medium">
                  {profile.address || "Not provided"}
                </p>
              </div>

            </div>
          </section>

          {/* Job Information */}
          <section className="mt-8">
            <h3 className="mb-4 text-lg font-semibold">
              Job Information
            </h3>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <p className="text-sm text-muted-foreground">
                  Login ID
                </p>
                <p className="font-medium">
                  {userData.login_id}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Employee Code
                </p>
                <p className="font-medium">
                  {userData.employee_code || "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Job Position
                </p>
                <p className="font-medium">
                  {profile.job_position || "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Department
                </p>
                <p className="font-medium">
                  {profile.department || "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Date of Joining
                </p>
                <p className="font-medium">
                  {profile.date_of_joining}
                </p>
              </div>

            </div>
          </section>

        </Card>
      </div>
    </main>
  );
}