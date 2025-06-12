import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── MongoDB ──────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const productSchema = new mongoose.Schema({
  name: String,
  photo: String,
  description: String,
  price: Number,
  extraPhotos: [String],
});
const Product = mongoose.model("Product", productSchema);

// ─── Cloudinary Config ────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// ─── Upload Endpoint ──────────────────────────────
app.post("/api/products", (req, res) => {
  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Form error", details: err });

    try {
      const { name, description, price } = fields;

      const photo = files.photo?.[0] || files.photo;
      const extraPhotos = files.extraPhotos || [];

      const upload = async (file) => {
        const result = await cloudinary.uploader.upload(file.filepath);
        return result.secure_url;
      };

      const photoUrl = photo ? await upload(photo) : null;
      const extraPhotosArr = Array.isArray(extraPhotos)
        ? await Promise.all(extraPhotos.map(upload))
        : extraPhotos?.filepath ? [await upload(extraPhotos)] : [];

      const product = await Product.create({
        name,
        photo: photoUrl,
        description,
        price,
        extraPhotos: extraPhotosArr,
      });

      res.status(201).json({ message: "✅ Product created", product });
    } catch (err) {
      res.status(500).json({ error: "Upload failed", details: err });
    }
  });
});

// ─── Get All ──────────────────────────────────────
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ─── Delete Product ───────────────────────────────
app.delete("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Not found" });

    await product.deleteOne();
    res.json({ message: "🗑️ Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed", details: err });
  }
});

export default app;
