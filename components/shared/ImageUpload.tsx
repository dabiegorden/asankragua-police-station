"use client";

import { useState } from "react";
import { CldImage, CldUploadWidget } from "next-cloudinary";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

export default function ImageUpload({
  value,
  onChange,
  folder = "police-management",
  disabled = false,
}) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = (result) => {
    if (result.event === "success") {
      onChange(result.info.secure_url);
      toast.success("Image uploaded successfully");
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onChange("");
    toast.success("Image removed");
  };

  return (
    <div className="space-y-4">
      {value && (
        <div className="relative">
          <CldImage
            src={value}
            width="300"
            height="300"
            crop={{
              type: "auto",
              source: true,
            }}
            className="rounded-lg object-cover"
            alt="Uploaded image"
          />
          {!disabled && (
            <Button
              type="button"
              onClick={handleRemove}
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {!disabled && (
        <CldUploadWidget
          uploadPreset="police-management"
          options={{
            folder,
            maxFiles: 1,
            resourceType: "auto",
          }}
          onUpload={handleUpload}
          onOpen={() => setIsUploading(true)}
          onClose={() => setIsUploading(false)}
        >
          {({ open }) => (
            <Button
              type="button"
              onClick={() => open()}
              disabled={isUploading}
              variant="outline"
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading
                ? "Uploading..."
                : value
                ? "Change Image"
                : "Upload Image"}
            </Button>
          )}
        </CldUploadWidget>
      )}
    </div>
  );
}
