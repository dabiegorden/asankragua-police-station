import cloudinary from "@/lib/cloudinary";

export async function uploadProfilePhoto(
  file: File,
  userId: string,
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "police-system/profiles",
        public_id: `user_${userId}`,
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { fetch_format: "auto", quality: "auto" },
        ],
      },
      (error: any, result: any) => {
        if (error || !result) return reject(error);
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}
