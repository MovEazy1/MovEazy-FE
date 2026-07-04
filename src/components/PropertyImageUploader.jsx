import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { uploadPropertyMediaFile } from "../lib/propertyImageUpload";

export default function PropertyImageUploader({ onUploadComplete }) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadedType, setUploadedType] = useState("");
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    setMessage("");
    if (!user?.email) {
      alert("Please log in first to upload property media.");
      return;
    }
    if (!selectedFile) {
      setMessage("Please choose a photo or video first.");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadPropertyMediaFile(selectedFile);
      setUploadedUrl(url);
      setUploadedType(String(selectedFile.type || ""));
      setMessage("Media uploaded successfully.");
      if (typeof onUploadComplete === "function") {
        onUploadComplete(url);
      }
    } catch (error) {
      setMessage(error?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "14px",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>
        Property media upload
      </div>

      <input
        type="file"
        accept="image/*,video/*"
        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
        style={{ marginBottom: "10px" }}
      />

      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        style={{
          padding: "9px 14px",
          borderRadius: "8px",
          border: "none",
          background: uploading ? "#94a3b8" : "#0f172a",
          color: "white",
          fontWeight: 700,
          cursor: uploading ? "not-allowed" : "pointer",
        }}
      >
        {uploading ? "Uploading..." : "Upload media"}
      </button>

      {message ? (
        <div style={{ marginTop: "10px", fontSize: "12px", color: "#475569", fontWeight: 600 }}>
          {message}
        </div>
      ) : null}

      {uploadedUrl ? (
        <div style={{ marginTop: "10px" }}>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>Uploaded media preview</div>
          {uploadedType.startsWith("video/") ? (
            <video
              src={uploadedUrl}
              controls
              style={{ width: "100%", maxWidth: "300px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
            />
          ) : (
            <img
              src={uploadedUrl}
              alt="Uploaded property"
              style={{ width: "100%", maxWidth: "260px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

