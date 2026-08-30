"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * Log in, or make an account.
 *
 * One form, not two behind tabs: the fields are nearly the same and the tab
 * strip mostly served to make a four-field dialog look like it had somewhere
 * to navigate. What used to sit under it — a disabled "GitHub login (coming
 * soon)" button, a promise of no credit card for software nobody is selling,
 * and an agreement to use the app responsibly — has gone for the same reason.
 */
export function AuthModal({
  open,
  onOpenChange,
  defaultTab = "login",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: "login" | "signup";
}) {
  const [mode, setMode] = React.useState<"login" | "signup">(defaultTab);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (open) setMode(defaultTab);
  }, [open, defaultTab]);

  const signingUp = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (signingUp) {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Signup failed");
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error) {
        throw new Error(
          result?.error === "CredentialsSignin"
            ? "That email and password don't match an account here."
            : result?.error || "Login failed"
        );
      }
      toast({ title: signingUp ? "Account created" : "Welcome back" });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast({
        title: signingUp ? "Couldn't create the account" : "Couldn't log you in",
        description: String(err instanceof Error ? err.message : err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[26rem]">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="display text-[1.75rem]">
            {signingUp ? "Make an account" : "Welcome back"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {signingUp
              ? "The account lives in this deployment's own database. Gmail comes next, and separately."
              : "The account, not your Google one — that stays with Google."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="mt-1 space-y-3.5">
          {signingUp && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name" className="text-xs font-normal text-muted-foreground">
                Name <span className="text-muted-foreground/70">— optional</span>
              </Label>
              <Input
                id="auth-name"
                type="text"
                autoComplete="name"
                placeholder="Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="auth-email" className="text-xs font-normal text-muted-foreground">
              Email
            </Label>
            <Input
              id="auth-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-pass" className="text-xs font-normal text-muted-foreground">
              Password
              {signingUp && (
                <span className="text-muted-foreground/70"> — at least 8 characters</span>
              )}
            </Label>
            <Input
              id="auth-pass"
              type="password"
              required
              minLength={signingUp ? 8 : undefined}
              autoComplete={signingUp ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="mt-1 w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {signingUp ? "Create account" : "Log in"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {signingUp ? "Been here before? " : "No account yet? "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            onClick={() => setMode(signingUp ? "login" : "signup")}
          >
            {signingUp ? "Log in" : "Make one"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
