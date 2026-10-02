/**
 * Shrink a video in the browser so it fits Supabase Storage's upload limit.
 *
 * The project is on Supabase's Free plan, where every upload is capped at
 * 50 MB and the cap cannot be raised. A minute of phone video is often 80–150
 * MB, so a walk-through simply never arrived. Here the video is played into a
 * canvas at up to 720p and re-recorded with MediaRecorder at a bitrate worked
 * out from its length, sound included — no library to download. It takes as
 * long as the video runs (a one-minute clip, about a minute).
 */

/** Supabase Free plan: the most any one upload may be. */
export const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;
/** What a shrunk video aims for — under the limit with room for container overhead. */
export const VIDEO_TARGET_BYTES = 44 * 1024 * 1024;
/** Longer than this and even a low bitrate looks poor; ask for a shorter clip. */
export const MAX_VIDEO_SECONDS = 10 * 60;

/** Video bits per second so `seconds` of video lands under `targetBytes`, kept between 0.25 and 4 Mbps. */
export function targetBitrate(seconds, targetBytes = VIDEO_TARGET_BYTES, audioBps = 96_000) {
  const budget = targetBytes * 8 * 0.9; // ~10% for the container and the encoder overshooting
  const v = Math.floor(budget / Math.max(1, seconds) - audioBps);
  return Math.max(250_000, Math.min(v, 4_000_000));
}

/** Fit (w, h) inside a `maxSide` box, even numbers (encoders want them). */
export function fitSize(w, h, maxSide = 1280) {
  const s = Math.min(1, maxSide / Math.max(w || 1, h || 1));
  return [Math.max(2, Math.round((w * s) / 2) * 2), Math.max(2, Math.round((h * s) / 2) * 2)];
}

/** The best recording format this browser has: MP4 where it can (plays everywhere), else WebM. */
export function pickRecorderType(isSupported = (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) {
  return [
    "video/mp4;codecs=avc1.42E01F,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find((t) => isSupported(t)) || "";
}

export const canShrinkVideo = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined"
  && typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"
  && Boolean(pickRecorderType());

/**
 * Re-encode `file` small enough to upload. Resolves to a new File; rejects
 * with a message a person can act on. `onProgress(0..100)` as it goes.
 */
export async function shrinkVideo(file, { onProgress, targetBytes = VIDEO_TARGET_BYTES, maxSide = 1280 } = {}) {
  if (!canShrinkVideo()) {
    throw new Error("this browser can't shrink videos — open it in Chrome, or pick a video under 50 MB");
  }
  const type = pickRecorderType();
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  let audioCtx = null;
  let timer = 0;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("this video couldn't be read — try another format (MP4 works best)"));
    });
    let seconds = Number(video.duration);
    if (!Number.isFinite(seconds) || seconds <= 0) seconds = 120;
    if (seconds > MAX_VIDEO_SECONDS) throw new Error("videos up to 10 minutes only — trim it and try again");

    const [w, h] = fitSize(video.videoWidth, video.videoHeight, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(30);

    // Sound: routed through Web Audio into the recording, and not to the speakers.
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const src = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        src.connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        await audioCtx.resume().catch(() => {});
      }
    } catch { /* silent video is better than none */ }

    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: targetBitrate(seconds, targetBytes), audioBitsPerSecond: 96_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

    const draw = () => {
      if (video.readyState >= 2) ctx.drawImage(video, 0, 0, w, h);
      onProgress?.(Math.min(99, Math.round((video.currentTime / seconds) * 100)));
    };
    // A timer rather than animation frames: it keeps going if the tab loses focus.
    timer = window.setInterval(draw, 1000 / 30);
    recorder.start(1000);
    try {
      await video.play();
    } catch {
      // Autoplay with sound refused: carry on muted.
      video.muted = true;
      await video.play();
    }
    await new Promise((resolve, reject) => {
      video.onended = resolve;
      video.onerror = () => reject(new Error("the video stopped playing while shrinking"));
    });
    draw();
    recorder.stop();
    await stopped;

    const base = type.split(";")[0];
    const blob = new Blob(chunks, { type: base });
    if (blob.size > STORAGE_LIMIT_BYTES) throw new Error("still over 50 MB after shrinking — trim the video and try again");
    onProgress?.(100);
    const ext = base.includes("mp4") ? "mp4" : "webm";
    const name = String(file.name || "video").replace(/\.[^.]+$/, "") + `-720p.${ext}`;
    return new File([blob], name, { type: base });
  } finally {
    window.clearInterval(timer);
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    audioCtx?.close?.().catch?.(() => {});
  }
}
