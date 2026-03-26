"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentQueue = exports.connection = void 0;
const bullmq_1 = require("bullmq");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// ⚠️ PAS de new IORedis ici !
exports.connection = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    maxRetriesPerRequest: null,
};
// Queue
exports.documentQueue = new bullmq_1.Queue("documents", { connection: exports.connection });
