"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, useAuth, UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useProModal } from "@/hooks/useProModal";

interface AuthButtonsProps {
  isPro: boolean;
}

export const AuthButtons = ({ isPro }: AuthButtonsProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const promodal = useProModal();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render anything until mounted to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div className="flex gap-x-3 items-center">
        {/* Placeholder to maintain layout */}
        <div className="w-20 h-8" />
      </div>
    );
  }

  return (
    <div className="flex gap-x-3 items-center">
      {isSignedIn && !isPro && (
        <Button
          variant={'premium'}
          size={"sm"}
          onClick={promodal.onOpen}
        >
          <span>Upgrade</span>
          <Sparkles className="h-4 w-4 fill-white ml-2 text-white" />
        </Button>
      )}
      <SignedIn>
        <UserButton afterSignOutUrl="/sign-in" />
      </SignedIn>
      <SignedOut>

        <SignInButton mode="modal">
          <Button asChild className="rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0 px-6" size="sm">
            <Link href="">Login</Link>
          </Button>
        </SignInButton>
      </SignedOut>
    </div>
  );
};