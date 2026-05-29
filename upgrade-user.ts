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

  const emailArg = process.argv[2];

  if (!emailArg) {
    console.log("\n📋 Active User Accounts:");
    const users = await User.find({}, 'name email role status');
    if (users.length === 0) {
      console.log("  No users found in database.");
    } else {
      users.forEach(u => {
        console.log(`  - Name: ${u.name} | Email: ${u.email} | Role: ${u.role} | Status: ${u.status}`);
      });
    }
    console.log("\n💡 Tip: Run this script with a user's email to make them an Admin!");
    console.log("   Example: npx tsx upgrade-user.ts buyer@example.com");
    console.log("   Or: npx tsx upgrade-user.ts --all (to upgrade all users to Admin for testing)");
    process.exit(0);
  }

  if (emailArg === '--all') {
    console.log("\n⚠️ Upgrading ALL users to Admin role...");
    const result = await User.updateMany({}, { $set: { role: 'Admin' } });
    console.log(`✅ Success! Upgraded ${result.modifiedCount} user(s) to Admin role.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`🔍 Looking for user with email: ${emailArg}`);
  const user = await User.findOne({ email: emailArg });

  if (!user) {
    console.error(`❌ User not found with email: ${emailArg}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.name} (Current Role: ${user.role})`);
  user.role = 'Admin';
  await user.save();
  console.log(`👑 Success! User ${user.email} is now an Admin!`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("❌ Error running script:", err);
  process.exit(1);
});
