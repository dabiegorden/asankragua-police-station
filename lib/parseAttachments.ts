// src/lib/parseAttachments.ts
//
// Uploads an array of File objects to Cloudinary and returns a normalised
// attachment array that matches the AttachmentSchema in the Case model.
//
// Usage:
//   const files = formData.getAll("attachments") as File[];
//   const attachments = await parseAttachments(files, "cases");

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

export interface UploadedAttachment {
  url: string;
  publicId: string;
  originalName?: string;
  resourceType?: string;
  format?: string;
  bytes?: number;
}

/**
 * Upload an array of browser File objects to Cloudinary.
 *
 * @param files   Array of File objects from formData.getAll()
 * @param folder  Cloudinary folder name (e.g. "cases", "personnel")
 */
export async function parseAttachments(
  files: File[],
  folder = "cases",
): Promise<UploadedAttachment[]> {
  if (!files || files.length === 0) return [];

  const uploads = await Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "auto" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        stream.end(buffer);
      });

      return {
        url: result.secure_url as string,
        publicId: result.public_id as string,
        originalName: file.name,
        resourceType: result.resource_type as string,
        format: result.format as string,
        bytes: result.bytes as number,
      } satisfies UploadedAttachment;
    }),
  );

  return uploads;
}
