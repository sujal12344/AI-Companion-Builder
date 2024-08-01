import { UserButton } from "@clerk/nextjs";
import React from "react";

const page = () => {
  return (
    <div className="flex justify-center items-center h-[70vh] scale-[2]">
      <UserButton afterSignOutUrl="/" />
    </div>
  );
};

export default page;
