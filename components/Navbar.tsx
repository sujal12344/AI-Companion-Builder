"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Poppins } from "next/font/google";
import { SignedIn, SignedOut, useAuth, UserButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import MobileSidebar from "./MobileSidebar";
import { useProModal } from "@/hooks/useProModal";
import { MobileNav } from "./MobileNav";
import logo from '@/public/ai.png';
import Image from "next/image";

const font = Poppins({
  weight: "600",
  subsets: ["latin"],
});

interface NavBarProps {
  isPro: boolean;
}

const NavBar = ({ isPro }: NavBarProps) => {

  const promodal = useProModal();
  const { isSignedIn } = useAuth();

  return (
      <div className="w-full z-50 flex justify-between items-center fixed bg-secondary border-b border-primary/10 px-4 py-2 h-16">
          <div className="flex items-center">
              <MobileNav isPro={isPro} />
              <Link href={"/"} className="flex items-center">
                  <Image src={logo} className="mr-2 hidden sm:block" width={42} height={42} alt="title" />
                  <h1 className="hidden sm:block text-xl md:text-3xl font-bold text-primary">
                      companion.ai
                  </h1>
              </Link>

          </div>
          <div className="flex gap-x-3 items-center">
              {isSignedIn && !isPro && (
                  <Button variant={'premium'}
                      size={"sm"}
                      onClick={promodal.onOpen}
                  >
                      Upgrade
                      <Sparkles className="h-4 w-4 fill-white ml-2 text-white" />
                  </Button>
              )}
              <ModeToggle />
              <SignedIn>
                  <UserButton afterSignOutUrl="/sign-in" />
              </SignedIn>
              <SignedOut>
                  <Button asChild className="rounded-full bg-gradient-to-r from-sky-500  to-cyan-500 text-white border-0 px-6" size="sm">
                      <Link href="/sign-in">
                          Login
                      </Link>
                  </Button>
              </SignedOut>
          </div>
      </div>);
}

export default NavBar;
