import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

// ⚠️ PAS de new IORedis ici !
export const connection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT!),
  maxRetriesPerRequest: null,
};

// Queue
export const documentQueue = new Queue("documents", { connection });