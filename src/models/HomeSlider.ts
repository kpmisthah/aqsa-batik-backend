import mongoose from "mongoose";

const HomeSliderSchema = new mongoose.Schema(
  {
    image: { type: String, default: '' },
    imageAlt: { type: String, default: 'Promo Banner' },
    bgColor: { type: String, required: true, default: '#F4F1EA' },
    tagline: { type: String },
    
    title: { type: String, required: true },
    highlightWord: { type: String }, // specific word to color with accent (e.g. "Cotton")
    
    subtitle: { type: String, default: '' },
    description: { type: String, default: '' },
    badge: { type: String },
    
    primaryButtonLabel: { type: String, default: 'SHOP NOW' },
    primaryButtonLink: { type: String, default: '/collections' },
    
    secondaryButtonLabel: { type: String },
    secondaryButtonLink: { type: String },
    
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const HomeSlider = mongoose.model("HomeSlider", HomeSliderSchema);
export default HomeSlider;
