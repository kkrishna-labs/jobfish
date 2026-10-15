// Connect to MongoDB (e.g. a free MongoDB Atlas cluster) using MONGODB_URI from .env.
import mongoose from 'mongoose';

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing. Add your MongoDB Atlas connection string to .env');
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'jobfish' });
}
