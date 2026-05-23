import Link from "next/link";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../src/components/ui";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Escrow Not Found</CardTitle>
          <CardDescription>
            The escrow you requested was not found for the currently selected network.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link href="/">Back to Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/studio">Open Studio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
