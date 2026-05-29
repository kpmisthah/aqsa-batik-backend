import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

console.log("Configured:", cloudinary.config().cloud_name);
cloudinary.api.ping()
  .then(res => console.log("Ping success:", res))
  .catch(err => console.error("Ping error:", err));
