import { useEffect, useMemo, useRef, useState } from "react";

function isVideoFile(file) {
  return String(file?.type || "").startsWith("video/");
}

function moveInArray(arr, fromIndex, toIndex) {
  if (!arr?.length || fromIndex == null || toIndex == null || fromIndex === toIndex) return arr;
  const next = [...arr];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function MediaUploadField({
  files,
  setFiles,
  maxFiles = 12,
  title = "Photos & Videos",
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const fileKeyRef = useRef(new WeakMap());
  const keySeq = useRef(0);

  const getFileKey = (file) => {
    if (!file) return "x";
    let k = fileKeyRef.current.get(file);
    if (!k) {
      k = `m-${++keySeq.current}`;
      fileKeyRef.current.set(file, k);
    }
    return k;
  };

  const previews = useMemo(
    () =>
      (files || []).map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isVideo: isVideoFile(file),
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [previews]);

  const appendFiles = (incoming) => {
    const valid = Array.from(incoming || []).filter(Boolean);
    if (!valid.length) return;
    setFiles((prev) => [...(prev || []), ...valid].slice(0, maxFiles));
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    appendFiles(e.dataTransfer?.files || []);
  };

  const removeAt = (idx) => {
    setFiles((prev) => (prev || []).filter((_, i) => i !== idx));
  };

  const reorder = (from, to) => {
    if (from == null || to == null || from === to) return;
    setFiles((prev) => moveInArray([...(prev || [])], from, to));
  };

  const shiftLeft = (idx) => {
    if (idx <= 0) return;
    reorder(idx, idx - 1);
  };

  const shiftRight = (idx) => {
    if (idx >= (files?.length || 0) - 1) return;
    reorder(idx, idx + 1);
  };

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
        {title} ({files.length}/{maxFiles})
      </div>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px", lineHeight: 1.45 }}>
        Drag thumbnails to change order (first image is often used as the cover). On mobile, use ◀ ▶ to move one step.
      </div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          display: "block",
          border: `2px dashed ${isDragging ? "#2563eb" : "#cbd5e1"}`,
          background: isDragging ? "#eff6ff" : "#f8fafc",
          borderRadius: "10px",
          padding: "12px",
          cursor: "pointer",
        }}
      >
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => appendFiles(e.target.files || [])}
          style={{ display: "none" }}
        />
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
          Drag & drop media here, or click to upload
        </div>
        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
          Supports mixed photos/videos. Recommended 7-8 media files per listing.
        </div>
      </label>

      {previews.length > 0 && (
        <div
          style={{
            marginTop: "10px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
            gap: "8px",
          }}
        >
          {previews.map((item, idx) => (
            <div
              key={getFileKey(item.file)}
              draggable
              onDragStart={(e) => {
                setDragFrom(idx);
                try {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(idx));
                } catch {
                  /* ignore */
                }
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOverIdx(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragFrom !== null) setDragOverIdx(idx);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const from = dragFrom;
                setDragFrom(null);
                setDragOverIdx(null);
                if (from == null || from === idx) return;
                reorder(from, idx);
              }}
              style={{
                position: "relative",
                cursor: dragFrom === idx ? "grabbing" : "grab",
                opacity: dragFrom === idx ? 0.55 : 1,
                outline: dragOverIdx === idx && dragFrom !== null && dragFrom !== idx ? "2px solid #2563eb" : "none",
                outlineOffset: 2,
                borderRadius: "10px",
                touchAction: "none",
              }}
            >
              {item.isVideo ? (
                <video src={item.url} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", pointerEvents: "none" }} muted />
              ) : (
                <img src={item.url} alt={item.file.name} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", pointerEvents: "none" }} draggable={false} />
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: "4px",
                  left: "4px",
                  right: "4px",
                  display: "flex",
                  gap: "4px",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    shiftLeft(idx);
                  }}
                  disabled={idx === 0}
                  title="Move left"
                  style={{
                    flex: 1,
                    maxWidth: "36px",
                    padding: "2px 0",
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.85)",
                    background: "rgba(15,23,42,0.75)",
                    color: "#fff",
                    cursor: idx === 0 ? "not-allowed" : "pointer",
                    opacity: idx === 0 ? 0.35 : 1,
                  }}
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    shiftRight(idx);
                  }}
                  disabled={idx >= previews.length - 1}
                  title="Move right"
                  style={{
                    flex: 1,
                    maxWidth: "36px",
                    padding: "2px 0",
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.85)",
                    background: "rgba(15,23,42,0.75)",
                    color: "#fff",
                    cursor: idx >= previews.length - 1 ? "not-allowed" : "pointer",
                    opacity: idx >= previews.length - 1 ? 0.35 : 1,
                  }}
                >
                  ▶
                </button>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(idx);
                }}
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "999px",
                  border: "none",
                  background: "rgba(15,23,42,0.8)",
                  color: "white",
                  fontSize: "11px",
                  cursor: "pointer",
                  zIndex: 2,
                }}
                aria-label="Remove media"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
