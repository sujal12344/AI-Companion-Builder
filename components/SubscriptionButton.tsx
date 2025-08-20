"use client";

import axios from "axios";
import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import errorResponse from "@/lib/errorResponse";

interface SubscriptionProps {
  isPro: boolean;
}

export const SubscriptionButton = ({ isPro }: SubscriptionProps) => {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/stripe");
      window.location.href = response.data.url;
    } catch (error) {
      errorResponse(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      disabled={loading}
      size="sm"
      variant={isPro ? "default" : "premium"}
      onClick={onClick}
    >
      {isPro ? "Manage Subscriptions" : "Upgrade"}
      {!isPro && <Sparkles className="w-4 h-4 ml-2 fill-white" />}
    </Button>
  );
};
