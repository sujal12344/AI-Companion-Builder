"use client";

import { useEffect, useState } from "react";
import { CldUploadButton } from "next-cloudinary";
import Image from "next/image";
import errorResponse from "@/lib/errorResponse";
import { useToast } from "@/components/ui/use-toast";
import { Camera, Sparkles, UploadCloud } from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (src: string) => void;
  disabled: boolean;
}

const ImageUpload = ({ value, onChange, disabled }: ImageUploadProps) => {
  const [isMounted, setIsMounted] = useState<Boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="w-full flex flex-col items-center justify-center py-2">
      <CldUploadButton
        options={{ maxFiles: 1 }}
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOADPRESET}
        onError={(error) => {
          console.log("Upload error:", error);
          errorResponse(error);
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload image. Please try again.",
          });
        }}
        onSuccess={(result, widget) => {
          console.log("Upload success - Full result:", result);

          // Extract the secure URL from the result
          const secureUrl =
            result?.info && typeof result.info !== "string"
              ? result.info.secure_url
              : "";

          if (secureUrl) {
            onChange(secureUrl);
            toast({
              title: "Upload Successful",
              description: "Avatar updated successfully!",
            });
          } else {
            console.error("Could not extract secure_url from result:", result);
            toast({
              variant: "destructive",
              title: "Upload Error",
              description: "Could not process uploaded image.",
            });
          }
        }}
      >
        <div
          className={`group relative flex flex-col items-center justify-center transition-all ${
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          {/* Avatar Container */}
          <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-dashed border-primary/30 group-hover:border-primary/80 transition-all duration-300 shadow-lg shadow-black/20 bg-secondary/30 flex items-center justify-center">
            {value ? (
              <>
                <Image
                  fill
                  alt="Companion Avatar"
                  src={value}
                  className="rounded-2xl object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 144px, 144px"
                />
                {/* Subtle Hover Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white gap-1 backdrop-blur-xs">
                  <Camera className="w-6 h-6 text-white drop-shadow" />
                  <span className="text-[11px] font-semibold tracking-wide">
                    Change Avatar
                  </span>
                </div>
                {/* Badge Icon */}
                <div className="absolute bottom-2 right-2 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md border border-background">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-foreground">
                  Upload Avatar
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  PNG, JPG, WebP
                </span>
              </div>
            )}
          </div>

          <span className="text-[11px] text-muted-foreground font-mono mt-2 flex items-center gap-1 group-hover:text-primary transition-colors">
            <Sparkles className="w-3 h-3 text-primary/70" />
            <span>Click to change avatar image</span>
          </span>
        </div>
      </CldUploadButton>
    </div>
  );
};

export default ImageUpload;
