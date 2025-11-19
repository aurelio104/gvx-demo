import express from "express";
import multer from "multer";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());

// Archivo que verán SIEMPRE las pantallas
const CURRENT_OUTPUT_PATH = "/tmp/gvx-current.mp4";

const upload = multer({ dest: "/tmp" });

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "gvx-demo-api" });
});

// 1) Endpoint de prueba: recorta y devuelve el mp4 por streaming directo
app.post("/media/trim", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Missing file field named "file"' });
    }

    const body = req.body as { start?: string; length?: string };
    const startSec = Number(body.start);
    const lengthSec = Number(body.length);

    if (!Number.isFinite(startSec) || !Number.isFinite(lengthSec) || lengthSec <= 0) {
      return res.status(400).json({ error: "start and length must be valid numbers" });
    }

    const inputPath = req.file.path;
    const ffmpegPath = process.env.FFMPEG_BIN || "ffmpeg";

    const args = [
      "-ss", String(startSec),
      "-t", String(lengthSec),
      "-i", inputPath,
      "-movflags", "+frag_keyframe+empty_moov",
      "-preset", "veryfast",
      "-c:v", "libx264",
      "-c:a", "aac",
      "-f", "mp4",
      "pipe:1"
    ];

    const ff = spawn(ffmpegPath, args);

    res.setHeader("Content-Type", "video/mp4");

    ff.stdout.pipe(res);

    ff.stderr.on("data", (data) => {
      console.error("FFmpeg STDERR (trim):", data.toString());
    });

    ff.on("close", (code) => {
      fs.unlink(inputPath, () => {});
      if (code !== 0) {
        console.error("FFmpeg exited with code", code);
      }
    });

    ff.on("error", (err) => {
      console.error("FFmpeg error (trim):", err);
      fs.unlink(inputPath, () => {});
      if (!res.headersSent) {
        res.status(500).json({ error: "FFmpeg error" });
      }
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

// 2) ADMIN: genera el video de pantallas y lo guarda SIEMPRE en CURRENT_OUTPUT_PATH
app.post("/media/trim-set", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Missing file field named "file"' });
    }

    const body = req.body as { start?: string; length?: string };
    const startSec = Number(body.start);
    const lengthSec = Number(body.length);

    if (!Number.isFinite(startSec) || !Number.isFinite(lengthSec) || lengthSec <= 0) {
      return res.status(400).json({ error: "start and length must be valid numbers" });
    }

    const inputPath = req.file.path;
    const ffmpegPath = process.env.FFMPEG_BIN || "ffmpeg";

    const args = [
      "-ss", String(startSec),
      "-t", String(lengthSec),
      "-i", inputPath,
      "-movflags", "+faststart",
      "-preset", "veryfast",
      "-c:v", "libx264",
      "-c:a", "aac",
      "-y",
      CURRENT_OUTPUT_PATH
    ];

    const ff = spawn(ffmpegPath, args);

    ff.stderr.on("data", (data) => {
      console.error("FFmpeg STDERR (trim-set):", data.toString());
    });

    ff.on("close", (code) => {
      fs.unlink(inputPath, () => {});
      if (code === 0) {
        console.log("✅ Nuevo video para pantallas:", CURRENT_OUTPUT_PATH);
        return res.json({ ok: true, path: CURRENT_OUTPUT_PATH });
      } else {
        console.error("FFmpeg exited with code", code);
        return res.status(500).json({ error: "FFmpeg error" });
      }
    });

    ff.on("error", (err) => {
      console.error("FFmpeg error (trim-set):", err);
      fs.unlink(inputPath, () => {});
      if (!res.headersSent) {
        res.status(500).json({ error: "FFmpeg error" });
      }
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

// 3) PLAYER: sirve el último video con soporte de Range (para pantallas)
app.get("/media/current", (req, res) => {
  try {
    if (!fs.existsSync(CURRENT_OUTPUT_PATH)) {
      return res.status(404).json({ error: "No current media" });
    }

    const stat = fs.statSync(CURRENT_OUTPUT_PATH);
    const fileSize = stat.size;
    const range = req.headers.range;

    console.log("📺 /media/current requested. Range:", range || "none", "Size:", fileSize);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || isNaN(end) || start >= fileSize) {
        return res.status(416).send("Requested Range Not Satisfiable");
      }

      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(CURRENT_OUTPUT_PATH, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4"
      });

      file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4"
      });

      fs.createReadStream(CURRENT_OUTPUT_PATH).pipe(res);
    }
  } catch (err) {
    console.error("Error in /media/current:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error serving current media" });
    }
  }
});

app.listen(port, () => {
  console.log("GVX Demo API listening on port", port);
});
