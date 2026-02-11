"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useUser, initiateAnonymousSignIn } from "@/firebase";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function StaffLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/staff/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleAnonymousLogin = () => {
    initiateAnonymousSignIn(auth);
  };

  if (isUserLoading) {
    return <div className="flex h-screen items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="flex justify-center items-center gap-2 mb-4 text-primary">
            <CreditCard className="h-8 w-8" />
            <h1 className="text-2xl font-bold tracking-tight font-headline">PezekaTrack</h1>
          </Link>
          <CardTitle className="text-2xl">Staff Portal</CardTitle>
          <CardDescription>Click below to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleAnonymousLogin} className="w-full">
            Enter Dashboard
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
