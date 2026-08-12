"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Loader2, ArrowRight, Github } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Wordmark } from "./logo";
import { useToast } from "@/hooks/use-toast";

export function AuthModal({
  open,
  onOpenChange,
  defaultTab = "login",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: "login" | "signup";
}) {
  const [tab, setTab] = React.useState<"login" | "signup">(defaultTab);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, name: name || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Signup failed");
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        throw new Error(
          result?.error === "CredentialsSignin"
            ? "Invalid email or password"
            : result?.error || "Login failed"
        );
      }
      toast({ title: tab === "signup" ? "Account created" : "Welcome back" });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast({
        title: "Authentication error",
        description: String(err instanceof Error ? err.message : err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <Wordmark />
          </div>
          <DialogTitle className="text-center">
            {tab === "login" ? "Welcome back" : "Create your account"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {tab === "login"
              ? "Log in to your AI email."
              : "Free forever. No credit card."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={submit} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-8"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-pass">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-pass"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full brand-gradient text-white"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Log in
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={submit} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="auth-name">Name (optional)</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-email-s">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-email-s"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-pass-s">Password (min 8 chars)</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-pass-s"
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full brand-gradient text-white"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Create account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="pt-2 text-center">
          <Button variant="outline" className="w-full" disabled>
            <Github className="h-4 w-4 mr-2" /> GitHub login (coming soon)
          </Button>
          <p className="text-[11px] text-muted-foreground mt-2">
            By continuing you agree to use InboxPilot responsibly.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
