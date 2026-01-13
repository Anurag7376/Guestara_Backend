import mongoose from "mongoose";

const connectDB = async (uri) => {
  mongoose.set("strictQuery", true);

  await mongoose.connect(uri);

  console.log("MongoDB Connected");
};
export default connectDB;
