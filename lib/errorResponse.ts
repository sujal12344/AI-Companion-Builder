import { toast } from "@/components/ui/use-toast";
import { AxiosError } from "axios";

const errorResponse = (error: unknown) => {
  return toast({
    variant: "destructive",
    description:
      error instanceof AxiosError
        ? error.response?.data?.error
        : "Something went wrong",
  });
};

export default errorResponse;
