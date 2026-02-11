import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Welcome!</CardTitle>
          <CardDescription>This is your new, clean application. What would you like to build today?</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You can start by telling me what you want to add.</p>
        </CardContent>
      </Card>
    </main>
  );
}
