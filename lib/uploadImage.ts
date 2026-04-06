const CLOUD_NAME = "dv70g6upv";
const UPLOAD_PRESET = "worktrace";

export async function uploadImage(uri: string): Promise<string> {
  const filename = uri.split("/").pop() ?? "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  const formData = new FormData();
  formData.append("file", {
    uri,
    type: mimeType,
    name: filename,
  } as any);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!res.ok) {
    const err = await res.json();
    console.error("Cloudinary error:", err);
    throw new Error(err?.error?.message ?? "Upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}
