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
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [email, setEmail] = useState("simon@pezeka.com");
  const [password, setPassword] = useState("symo@4927");

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/finance');
    }
  }, [user, isUserLoading, router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (email === "simon@pezeka.com" && password === "symo@4927") {
      toast({
        title: "Login Successful",
        description: "Redirecting to dashboard...",
      });
      initiateEmailSignIn(auth, email, password);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Credentials",
        description: "Please check your email and password.",
      });
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
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your credentials to access the portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="simon@pezeka.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
