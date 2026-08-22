import { Button } from "@/components/ui/button";

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <Button onClick={() => console.log("Dayflow shadcn button works")}>
        Dayflow is ready
      </Button>
    </main>
  );
}