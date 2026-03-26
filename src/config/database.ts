import mongoose from "mongoose";
import { Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

// Retourne la DB native pour GridFS
export const getDb = (): Db => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB not connected yet");
  return db;
};