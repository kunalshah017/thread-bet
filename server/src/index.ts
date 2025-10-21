import express, { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Health check route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Basic route
app.get("/", (req: Request, res: Response) => {
  res.send("Hello from ThreadBet Server!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
