import mongoose, { Schema, Document } from "mongoose";

export interface IDocument extends Document {
  documentId: string;
  userId: string;
  batchId: string;
  status: "pending" | "processing" | "completed" | "failed";
  pdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema: Schema = new Schema({
  documentId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  batchId: { type: String, required: true },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
  pdfUrl: { type: String },
}, { timestamps: true });

export default mongoose.model<IDocument>("Document", DocumentSchema);