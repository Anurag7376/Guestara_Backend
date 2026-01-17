import express from "express";
import cors from "cors";
import errorMiddleware from "./middlewares/error.middleware.js";
import itemRoutes from "./modules/item/item.routes.js";
import bookingModuleRoutes from "./modules/booking/booking.routes.js";
import bookingRoutes from "./routes/booking.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/items", itemRoutes);
app.use("/api", bookingModuleRoutes);
app.use("/api", bookingRoutes);

app.use(errorMiddleware);

export default app;
