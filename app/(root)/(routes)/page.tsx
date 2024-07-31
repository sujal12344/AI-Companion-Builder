import { UserButton } from "@clerk/nextjs";
import React from "react";

const page = () => {
  return (
    <div className="flex justify-center items-center h-full">
      <UserButton afterSignOutUrl="/" />
    </div>
  );
};

export default page;
