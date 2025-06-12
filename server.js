import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import formidable from "formidable";
import fs from "fs/promises";       // promise-based FS
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── MongoDB ────────────────────────────────────────────
await mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// store binary in Mongo
const photoSchema = new mongoose.Schema({
  data: Buffer,
  contentType: String,
});

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  photo: photoSchema,               // single main image
  extraPhotos: [photoSchema],       // array of images
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

// ─── Create / Upload ─────────────────────────────────────
app.post("/api/products", (req, res) => {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    uploadDir: path.join(__dirname, "tmp"),  // Vercel allows tmp writes here
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Form parse error", details: err });

    try {
      const { name, description, price } = fields;

      // Helper to read & delete a single file
      const processFile = async file => {
        const buffer = await fs.readFile(file.filepath);
        await fs.unlink(file.filepath);
        return {
          data: buffer,
          contentType: file.mimetype || "application/octet-stream",
        };
      };

      // main photo
      const photoFile = files.photo?.[0] || files.photo;
      const photoDoc = photoFile ? await processFile(photoFile) : null;

      // extraPhotos
      const extras = files.extraPhotos
        ? Array.isArray(files.extraPhotos)
          ? files.extraPhotos
          : [files.extraPhotos]
        : [];
      const extraDocs = await Promise.all(extras.map(processFile));

      const product = await Product.create({
        name,
        description,
        price: Number(price),
        photo: photoDoc,
        extraPhotos: extraDocs,
      });

      res.status(201).json({ message: "✅ Created", productId: product._id });
    } catch (e) {
      res.status(500).json({ error: "Save failed", details: e });
    }
  });
});

// ─── Get All ─────────────────────────────────────────────
app.get("/api/products", async (req, res) => {
  try {
    const prods = await Product.find().lean();
    // convert buffers to data-URIs
    const withImages = prods.map(p => {
      const toDataURI = img => img
        ? `data:${img.contentType};base64,${img.data.toString("base64")}`
        : null;

      return {
        ...p,
        photo: toDataURI(p.photo),
        extraPhotos: p.extraPhotos.map(toDataURI),
      };
    });
    res.json(withImages);
  } catch (e) {
    res.status(500).json({ error: "Fetch failed", details: e });
  }
});

// ─── Delete ──────────────────────────────────────────────
app.delete("/api/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "🗑️ Deleted" });
  } catch (e) {
    res.status(500).json({ error: "Delete failed", details: e });
  }
});

// ─── Export for Vercel ───────────────────────────────────
export default app;
