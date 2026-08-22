import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function App() {
  const [pingResult, setPingResult] = useState<string>("loading...");

  console.log("ENV URL:", import.meta.env.VITE_SUPABASE_URL);
  console.log("ENV ANON:", import.meta.env.VITE_SUPABASE_ANON_KEY);

  useEffect(() => {
    async function testSupabase() {
      const { data, error } = await supabase.rpc("ping");
      if (error) {
        console.error("Supabase connection error:", error);
        setPingResult("error: " + error.message);
      } else {
        console.log("Supabase ping:", data);
        setPingResult(data);
      }
    }
    testSupabase();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <Button onClick={() => console.log("Dayflow shadcn button works")}>
        Dayflow is ready
      </Button>
      <p>Supabase test query result: {pingResult}</p>
    </main>
  );
}