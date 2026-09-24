"use client";

import { useActionState } from "react";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { login, type LoginState } from "./actions";

export default function LoginForm({ configured, next = "" }: { configured: boolean; next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <div className="bg-muted mb-2 flex size-10 items-center justify-center rounded-full">
          <LockIcon className="size-4" />
        </div>
        <CardTitle>Dashboard EOD</CardTitle>
        <CardDescription>
          {configured
            ? "Podaj hasło, żeby zobaczyć zestawienie raportów."
            : "Ustaw zmienną DASHBOARD_PASSWORD (lokalnie w .env.local, na Vercel w Environment Variables) i odśwież stronę."}
        </CardDescription>
      </CardHeader>
      {configured && (
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <Field data-invalid={!!state.error}>
              <FieldLabel htmlFor="password">Hasło</FieldLabel>
              <Input id="password" name="password" type="password" autoComplete="current-password" autoFocus required aria-invalid={!!state.error} />
              <FieldError>{state.error}</FieldError>
            </Field>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Spinner />} Zaloguj
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
