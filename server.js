import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

// Load .env
dotenv.config();

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("⚡️ MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

// Order schema + model
const orderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  address: { type: String, required: true },
  age: { type: Number, required: true },
  phone: { type: String, required: true },
  province: { type: String, required: true },
  city: { type: String, required: true },
  braceletColor: { type: String, required: true },
  gender: { type: String, enum: ["male", "female"], required: true },
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);

// Initialize Express app
const app = express();
connectDB();

app.use(cors());
app.use(express.json());

// Routes

// Root
app.get("/", (req, res) => {
  res.send("🎨 Custom Bracelet Order API is running");
});

// Place an order
app.post("/api/order", async (req, res) => {
  try {
    const {
      name, email, address, age, phone, province, city,
      braceletColor, gender
    } = req.body;

    if (!name || !email || !address || !age || !phone || !province || !city || !braceletColor || !gender) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const order = new Order({
      name, email, address, age, phone, province, city,
      braceletColor, gender
    });
    await order.save();

    res.status(201).json({ success: true, message: "Order placed successfully", order });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// Get all orders (admin)
app.get("/api/order", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Start server
export default app;
