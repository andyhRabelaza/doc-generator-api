"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.specs = exports.swaggerUi = void 0;
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
exports.swaggerUi = swagger_ui_express_1.default;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const path_1 = __importDefault(require("path"));
// 🔹 Options Swagger
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Document Generator API",
            version: "1.0.0",
            description: "API pour générer des documents en batch (CERFA, conventions).",
        },
        servers: [
            { url: "http://localhost:3000/api" },
        ],
    },
    // 🔹 Chemin vers les fichiers JS compilés (dist)
    apis: [path_1.default.join(__dirname, "../routes/*.js")],
};
// 🔹 Génération des specs
const specs = (0, swagger_jsdoc_1.default)(options);
exports.specs = specs;
