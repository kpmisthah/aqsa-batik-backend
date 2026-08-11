import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HomeSlider from './src/models/HomeSlider.js';

dotenv.config();

const uri = process.env.MONGO_URI || "mongodb+srv://aqdaschhipa368_db_user:3EdB9N62TkjGLtWA@cluster0.wsbm9wn.mongodb.net/batik_store";

const slidesData = [
  {
    image: "/clean_slider_1.png",
    imageAlt: "Premium Batik Fabric",
    tagline: "PREMIUM BATIK COTTON COLLECTION",
    title: "Premium Batik Printed\nCotton Fabric",
    highlightWord: "Cotton",
    subtitle: "Crafted for Everyday Elegance",
    description: "Discover breathable batik printed cotton fabric designed for comfort, style, and timeless beauty. Perfect for boutiques, designers, and women who love effortless elegance.",
    badge: "",
    primaryButtonLabel: "SHOP COLLECTION",
    primaryButtonLink: "/batik-cloth",
    secondaryButtonLabel: "GET WHOLESALE PRICING",
    secondaryButtonLink: "/wholesale",
    bgColor: "#E0CFBB",
    order: 0,
    isActive: true
  },
  {
    image: "/clean_slider_2_pants.png",
    imageAlt: "Wholesale Batik Clothing",
    tagline: "MANUFACTURER DIRECT",
    title: "Wholesale Batik\nClothing & Suits",
    highlightWord: "Clothing",
    subtitle: "Zero Middleman Markup",
    description: "Stop guessing what will sell. Work with a direct manufacturer supplying high-demand batik fabric wholesale and consistent inventory for growing fashion brands.",
    badge: "",
    primaryButtonLabel: "GET CATALOGUE",
    primaryButtonLink: "/fabric-wholesale",
    secondaryButtonLabel: "VIEW COLLECTION",
    secondaryButtonLink: "/batik-suits",
    bgColor: "#DDC9B0",
    order: 1,
    isActive: true
  },
  {
    image: "/clean_slider_3.png",
    imageAlt: "Authentic Jaipuri Handblock Suits",
    tagline: "FESTIVE COLLECTION",
    title: "Authentic Jaipuri\nHandblock Suits",
    highlightWord: "Handblock",
    subtitle: "Experience True Heritage",
    description: "Explore our latest collection of intricately designed, premium cotton suits perfect for any occasion. Rich colors and patterns that celebrate tradition.",
    badge: "",
    primaryButtonLabel: "SHOP NEW ARRIVALS",
    primaryButtonLink: "/new-arrivals",
    secondaryButtonLabel: "VIEW CATALOG",
    secondaryButtonLink: "/catalog",
    bgColor: "#D5B793",
    order: 2,
    isActive: true
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB Connected for seeding...");

    // Clear existing slides
    await HomeSlider.deleteMany({});
    console.log("Deleted old slides (if any)");

    // Insert the new slides
    await HomeSlider.insertMany(slidesData);
    console.log("✅ Seeded 3 perfect slides into MongoDB successfully!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
};

seedDB();
