import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import catalogRouter from "./catalog/index.js";
import quoteRouter from "./quote/index.js";
import hedgerRouter from "./hedger/index.js";
import premiumRouter from "./premium/index.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
}));
app.use(express.json());

// Rate limiting: 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Mount routes
app.use("/markets", catalogRouter);
app.use("/quote", quoteRouter);
app.use("/exposure", hedgerRouter);
app.use("/premium", premiumRouter);

app.listen(PORT, () => {
  console.log(`ParlayCity services running on port ${PORT}`);
});

export default app;
