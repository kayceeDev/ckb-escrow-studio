import { StudioApp } from "../../src/StudioApp";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../src/components/ui";

export default function StudioPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Badge variant="outline">Studio</Badge>
        <Badge variant="secondary">Operator tooling</Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Escrow Studio</CardTitle>
          <CardDescription>
            Internal route for deployment profiles, escrow discovery, protocol operations, and transaction debugging.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use this route when you need low-level control. The public product surface should stay focused on escrow creation and lifecycle management.
        </CardContent>
      </Card>

      <StudioApp />
    </div>
  );
}
