import mongoose from "mongoose";

const BannerSchema = new mongoose.Schema(
  {
    page: { 
      type: String, 
      required: true, 
      unique: true,
      enum: ['home', 'wholesale', 'new-arrivals', 'batik-suits', 'batik-fabric']
    },
    imageUrl: { type: String, required: true },
  },
  { timestamps: true }
);

const Banner = mongoose.model("Banner", BannerSchema);

export default Banner;
