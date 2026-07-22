"use client";

import { useEffect, useState } from "react";
import { CldUploadButton } from "next-cloudinary";
import Image from "next/image";
import errorResponse from "@/lib/errorResponse";
import { useToast } from "@/components/ui/use-toast";

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
    <div className="space-y-4 w-full flex flex-col justify-between items-center">
      <CldUploadButton
        options={{ maxFiles: 1 }}
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOADPRESET}
        onError={(error) => {
          console.log('Upload error:', error);
          errorResponse(error);
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload image. Please try again.",
          });
        }}
        onSuccess={(result, widget) => {
          console.log('Upload success - Full result:', result);
          
          // Extract the secure URL from the result
          const secureUrl = result?.info && typeof result.info !== 'string' 
            ? result.info.secure_url 
            : '';
          
          if (secureUrl) {
            onChange(secureUrl);
            toast({
              title: "Upload Successful",
              description: "Image uploaded successfully!",
            });
          } else {
            console.error('Could not extract secure_url from result:', result);
            toast({
              variant: "destructive",
              title: "Upload Error",
              description: "Could not process uploaded image.",
            });
          }
        }}
      >
        <div className={`p-4 border-4 border-dashed border-primary/10 rounded-lg hover:opacity-75 transition flex flex-col space-y-2 items-center justify-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          <div className="relative h-40 w-40">
            <Image
              fill
              alt="upload"
              src={value || "/placeholder.svg"}
              className="rounded-lg object-cover"
              sizes=""
            />
          </div>
        </div>
      </CldUploadButton>
    </div>
  );
};

export default ImageUpload;
