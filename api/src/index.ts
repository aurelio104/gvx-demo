import express from "express";
import multer from "multer";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3001;

// Archivo actual para las pantallas
const CURRENT_OUTPUT_PATH = "/tmp/gvx-current.mp4";
// Archivo donde guardamos la programación
const SCHEDULE_PATH = "/tmp/gvx-schedule.json";
// Duración estándar del spot
const TARGET_LENGTH_SECONDS = 15;

app.use(cors());

const upload = multer({ dest: "/tmp" });

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "gvx-demo-api" });
});

function safeUnlink(path: string) {
  fs.unlink(path, () => {});
}

// 1) /media/trim -> recorta y devuelve el mp4 por streaming directo
app.post("/media/trim", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file field named "file"' });
    }

    const body = req.body as { start?: string };
    const startSec = Number(body.start) || 0;
    const lengthSec = TARGET_LENGTH_SECONDS;

    const inputPath = req.file.path;
    const ffmpegPath = process.env.FFMPEG_BIN || "ffmpeg";

    const args = [
      "-ss", String(startSec),
      "-t", String(lengthSec),
      "-i", inputPath,
      "-vf", "scale=1280:-2,fps=30",
      "-preset", "veryfast",
      "-crf", "28",
      "-movflags", "+frag_keyframe+empty_moov",
      "-c:v", "libx264",
      "-c:a", "aac",
      "-b:a", "128k",
      "-maxrate", "4M",
      "-bufsize", "8M",
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
      safeUnlink(inputPath);
      if (code !== 0) {
        console.error("FFmpeg exited (trim) with code", code);
      }
    });

    ff.on("error", (err) => {
      console.error("FFmpeg error (trim):", err);
      safeUnlink(inputPath);
      if (!res.headersSent) {
        res.status(500).json({ error: "FFmpeg error" });
      }
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// 2) /media/trim-set -> genera el video estándar y guarda la programación
app.post("/media/trim-set", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file field named "file"' });
    }

    const body = req.body as { start?: string; scheduledAt?: string };
    const startSec = Number(body.start) || 0;
    const lengthSec = TARGET_LENGTH_SECONDS;

    // Hora programada enviada desde el admin (ISO)
    let startTimeIso: string;
    const raw = body.scheduledAt;
    if (raw && !isNaN(Date.parse(raw))) {
      startTimeIso = new Date(raw).toISOString();
    } else {
      const now = new Date();
      startTimeIso = new Date(now.getTime() + 60000).toISOString();
    }

    const inputPath = req.file.path;
    const ffmpegPath = process.env.FFMPEG_BIN || "ffmpeg";

    const args = [
      "-ss", String(startSec),
      "-t", String(lengthSec),
      "-i", inputPath,
      "-vf", "scale=1280:-2,fps=30",
      "-preset", "veryfast",
      "-crf", "28",
      "-movflags", "+faststart",
      "-c:v", "libx264",
      "-c:a", "aac",
      "-b:a", "128k",
      "-maxrate", "4M",
      "-bufsize", "8M",
      "-y",
      CURRENT_OUTPUT_PATH
    ];

    const ff = spawn(ffmpegPath, args);

    ff.stderr.on("data", (data) => {
      console.error("FFmpeg STDERR (trim-set):", data.toString());
    });

    ff.on("exit", (code, signal) => {
      console.log("FFmpeg exit (trim-set): code=", code, "signal=", signal);
    });

    ff.on("close", (code) => {
      safeUnlink(inputPath);
      if (code === 0) {
        const schedule = {
          startTime: startTimeIso,
          durationSec: TARGET_LENGTH_SECONDS
        };
        try {
          fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule));
          console.log("Nueva programación guardada:", schedule);
        } catch (err) {
          console.error("Error escribiendo programación:", err);
        }
        if (!res.headersSent) {
          return res.json({ ok: true, path: CURRENT_OUTPUT_PATH, schedule });
        }
      } else {
        console.error("FFmpeg exited (trim-set) with code", code);
        if (!res.headersSent) {
          return res.status(500).json({
            error: "FFmpeg error (video demasiado pesado para esta instancia)"
          });
        }
      }
    });

    ff.on("error", (err) => {
      console.error("FFmpeg error (trim-set):", err);
      safeUnlink(inputPath);
      if (!res.headersSent) {
        res.status(500).json({ error: "FFmpeg error" });
      }
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// 3) /media/current -> sirve el último video (para las pantallas)
app.get("/media/current", (req, res) => {
  try {
    if (!fs.existsSync(CURRENT_OUTPUT_PATH)) {
      return res.status(404).json({ error: "No current media" });
    }

    const stat = fs.statSync(CURRENT_OUTPUT_PATH);
    const fileSize = stat.size;
    const range = req.headers.range;

    console.log("GET /media/current Range:", range || "none", "Size:", fileSize);

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
        "Content-Range": "bytes " + start + "-" + end + "/" + fileSize,
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

// 4) /schedule/next -> devuelve la programación y los segundos que faltan
app.get("/schedule/next", (_req, res) => {
  try {
    if (!fs.existsSync(SCHEDULE_PATH)) {
      return res.status(404).json({ error: "No schedule" });
    }
    const raw = fs.readFileSync(SCHEDULE_PATH, "utf-8");
    const schedule = JSON.parse(raw) as { startTime: string; durationSec: number };
    const now = new Date();
    const start = new Date(schedule.startTime);
    const secondsUntilStart = Math.round((start.getTime() - now.getTime()) / 1000);

    return res.json({
      startTime: schedule.startTime,
      durationSec: schedule.durationSec,
      now: now.toISOString(),
      secondsUntilStart
    });
  } catch (err) {
    console.error("Error in /schedule/next:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error reading schedule" });
    }
  }
});

app.listen(port, () => {
  console.log("GVX Demo API listening on port", port);
});
