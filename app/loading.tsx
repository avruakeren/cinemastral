import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function LoadingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <LoadingSpinner label="Memuat" />
    </main>
  );
}
