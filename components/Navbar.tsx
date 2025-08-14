"use client";

import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { MobileNav } from "./MobileNav";
import { AuthButtons } from "./AuthButtons";
import logo from "@/public/ai.png";
import Image from "next/image";

interface NavBarProps {
  isPro: boolean;
}

const NavBar = ({ isPro }: NavBarProps) => {
  return (
    <div className="w-full z-50 flex justify-between items-center fixed bg-secondary border-b border-primary/10 px-4 py-2 h-16">
      <div className="flex items-center">
        <MobileNav isPro={isPro} />
        <Link href={"/"} className="flex items-center">
          <Image
            src={logo}
            className="mr-2 hidden sm:block"
            width={42}
            height={42}
            alt="title"
          />
          <h1 className="hidden sm:block text-xl md:text-3xl font-bold text-primary">
            Companion.ai
          </h1>
        </Link>
      </div>
      <div className="flex gap-x-3 items-center">
        <ModeToggle />
        <AuthButtons isPro={isPro} />
      </div>
    </div>
  );
};

export default NavBar;
