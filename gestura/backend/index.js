require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const corsOptions = { origin: FRONTEND_ORIGIN.split(','), credentials: true };
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.options("*", cors(corsOptions));

// ROUTES
const authRoutes = require("./routes/authRoutes");
const guardianRoutes = require("./routes/guardianRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const datasetRoutes = require("./routes/datasetRoutes");
const profileRoutes = require("./routes/profile");
const predictRoutes = require("./routes/predict");

app.use("/auth", authRoutes);
app.use("/api/guardian", guardianRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/dataset", datasetRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/predict", predictRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`REST API running on port ${PORT}`);
});
