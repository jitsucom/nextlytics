"use client";

import { signIn } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LuGithub } from "react-icons/lu";
import { FaGoogle } from "react-icons/fa";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const handleSignIn = (provider: "github" | "google") => {
    signIn(provider, { callbackUrl: "/demo" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>Choose a provider to continue</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => handleSignIn("google")}
          >
            <FaGoogle className="size-4" />
            Continue with Google
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => handleSignIn("github")}
          >
            <LuGithub className="size-4" />
            Continue with GitHub
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
