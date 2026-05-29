import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

async function run() {
  if (!MONGO_URI) {
    console.error("❌ Error: MONGO_URI is missing from your .env file!");
    process.exit(1);
  }

  console.log("🔌 Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected successfully!");

  console.log("⚠️ Resetting arunjith and rizan to Customer role...");
  const result = await User.updateMany(
    { email: { $in: ['kacokom675@acanok.com', 'satikes420@ameady.com'] } },
    { $set: { role: 'Customer' } }
  );
  
  console.log(`✅ Success! Updated ${result.modifiedCount} user(s) back to Customer.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error("❌ Error running script:", err);
  process.exit(1);
});
