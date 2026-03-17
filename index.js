const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");

const app = express();

app.use(cors());
app.use(express.json());

// ABSOLUTE TOP PRIORITY: Serve PDFs explicitly to avoid ANY middleware interference (204 fix)
// 1.5. ULTIMATE BYPASS: Serve PDF data via POST request in JSON format
// IDM and other extensions almost never intercept POST requests returning JSON
app.post("/api/pdf-data", (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: "Missing filename" });

  const filePath = path.join(__dirname, "data", "files", filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    console.log(`[ULTIMATE BYPASS] Sent ${filename} as Base64 JSON (${fileBuffer.length} bytes)`);
    
    res.json({
      success: true,
      filename: filename,
      data: base64Data,
      contentType: 'application/pdf'
    });
  } catch (error) {
    console.error("Error reading file for base64:", error);
    res.status(500).json({ error: "Failed to process PDF data" });
  }
});

// Original route remains for direct downloads if needed
app.get("/files/:filename", (req, res) => {
  const filePath = path.join(__dirname, "data", "files", req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.sendFile(filePath);
});

// 2. Second Priority: API routes
app.use("/api", (req, res, next) => {
  next();
});


// 3. Third Priority: Client static files
app.use(express.static(path.join(__dirname, "client")));

// Configure Multer for PDF uploads
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "data", "files");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  },
});

// Paths to database files
const dbPath = path.join(__dirname, "data", "db", "delta_db.json");
const trashPath = path.join(__dirname, "data", "db", "delta_trash.json");

// (Moved up for priority)

// API Endpoint: Get Data
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
    console.error("Error reading db files:", error);
    res.status(500).json({ error: "Failed to read database files" });
  }
});

// API Endpoint: Save Data
app.post("/api/data", (req, res) => {
  try {
    const { clientsDB, trashDB } = req.body;

    // Optional: add some basic validation here if needed
    if (!Array.isArray(clientsDB) || !Array.isArray(trashDB)) {
      return res
        .status(400)
        .json({ error: "Invalid data format. Expected arrays." });
    }

    fs.writeFileSync(dbPath, JSON.stringify(clientsDB, null, 2));
    fs.writeFileSync(trashPath, JSON.stringify(trashDB, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error("Error writing db files:", error);
    res.status(500).json({ error: "Failed to write database files" });
  }
});

// API Endpoint: Upload PDF
app.post("/api/upload-pdf", upload.single("pdf"), (req, res) => {
  try {
    const { clientId } = req.body;
    const file = req.file;

    if (!file || !clientId) {
      return res.status(400).json({ error: "Missing file or clientId" });
    }

    const clientsDB = fs.existsSync(dbPath)
      ? JSON.parse(fs.readFileSync(dbPath, "utf-8"))
      : [];
    const client = clientsDB.find((c) => c.id === clientId);

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (!client.pdfs) client.pdfs = [];

    const pdfMetadata = {
      originalName: file.originalname,
      filename: file.filename,
      date: new Date().toISOString().split("T")[0],
      path: "/files/" + file.filename,
    };

    client.pdfs.push(pdfMetadata);
    fs.writeFileSync(dbPath, JSON.stringify(clientsDB, null, 2));

    res.json({ success: true, pdf: pdfMetadata });
  } catch (error) {
    console.error("Error uploading PDF:", error);
    res.status(500).json({ error: "Failed to upload PDF" });
  }
});

// API Endpoint: Permanent Delete (from Trash)
app.post("/api/permanent-delete-client", (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: "Missing clientId" });

    let clientsDB = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf-8")) : [];
    let trashDB = fs.existsSync(trashPath) ? JSON.parse(fs.readFileSync(trashPath, "utf-8")) : [];

    const clientIdx = trashDB.findIndex((c) => c.id === clientId);
    if (clientIdx === -1) {
      return res.status(404).json({ error: "Client not found in trash" });
    }

    const client = trashDB[clientIdx];

    // 1. Delete associated PDF files from disk
    if (client.pdfs && Array.isArray(client.pdfs)) {
      client.pdfs.forEach((pdf) => {
        const filePath = path.join(__dirname, "data", "files", pdf.filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`[Permanent Delete] Deleted file: ${pdf.filename}`);
          } catch (err) {
            console.error(`Failed to delete file ${pdf.filename}:`, err);
          }
        }
      });
    }

    // 2. Remove client from trashDB
    trashDB.splice(clientIdx, 1);

    // 3. Save updated databases
    fs.writeFileSync(dbPath, JSON.stringify(clientsDB, null, 2));
    fs.writeFileSync(trashPath, JSON.stringify(trashDB, null, 2));

    console.log(`[Permanent Delete] Client ${clientId} permanently removed.`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error during permanent deletion:", error);
    res.status(500).json({ error: "Failed to permanently delete client" });
  }
});

// API Endpoint: Create Backup (ZIP of data folder)
app.get("/api/backup", (req, res) => {
  try {
    const zip = new AdmZip();
    const dataFolder = path.join(__dirname, "data");

    if (!fs.existsSync(dataFolder)) {
      return res.status(404).json({ error: "Data folder not found" });
    }

    zip.addLocalFolder(dataFolder);
    const buffer = zip.toBuffer();

    const date = new Date().toISOString().split("T")[0];
    const fileName = `delta_backup_${date}.zip`;

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=${fileName}`,
      "Content-Length": buffer.length,
    });

    res.send(buffer);
    console.log(`[Backup] Created backup: ${fileName} (${buffer.length} bytes)`);
  } catch (error) {
    console.error("Backup error:", error);
    res.status(500).json({ error: "Failed to create backup" });
  }
});

// Reuse multer for backup restoration
const backupUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === ".zip") {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed!"), false);
    }
  },
});

// API Endpoint: Restore Backup
app.post("/api/restore", backupUpload.single("backup"), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No backup file provided" });

    const zip = new AdmZip(file.buffer);
    const dataFolder = path.join(__dirname, "data");

    // Safety check: ensure the ZIP contains a db folder or known files
    const entries = zip.getEntries();
    const hasDb = entries.some(e => e.entryName.includes("db/"));
    if (!hasDb) {
      return res.status(400).json({ error: "Invalid backup format. Missing 'db' directory." });
    }

    console.log("[Restore] Starting restoration...");

    // Recursive function to clear directory
    const clearDir = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          const curPath = path.join(dirPath, file);
          if (fs.lstatSync(curPath).isDirectory()) {
            clearDir(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(dirPath);
      }
    };

    // Clear and restore
    clearDir(dataFolder);
    fs.mkdirSync(dataFolder, { recursive: true });
    zip.extractAllTo(dataFolder, true);

    console.log("[Restore] Restoration completed successfully.");
    res.json({ success: true });
  } catch (error) {
    console.error("Restore error:", error);
    res.status(500).json({ error: "Failed to restore backup" });
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
