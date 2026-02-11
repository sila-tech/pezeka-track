"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useUser, initiateEmailSignIn } from "@/firebase";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    if (!password) {
        toast({
            variant: "destructive",
            title: "Password is required",
            description: "Please enter your password.",
        });
        return;
    }

    if (email.endsWith('@admin.com')) {
      toast({
        title: "Admin Login Successful",
        description: "Redirecting to dashboard...",
      });
      initiateEmailSignIn(auth, email, password);
    } else if (email.endsWith('@finance.com')) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Finance users must use the Finance Portal.",
      });
    } else {
      toast({
        title: "Staff Login Successful",
        description: "Redirecting to dashboard...",
      });
      initiateEmailSignIn(auth, email, password);
    }
  };

  if (isUserLoading || user) {
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
          <CardTitle className="text-2xl">Staff Login</CardTitle>
          <CardDescription>Enter your credentials to access the staff portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="staff@pezeka.com" required defaultValue="staff@pezeka.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
