import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/dbConnect.js";

dotenv.config();
connectDB(process.env.MONGO_URI);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
