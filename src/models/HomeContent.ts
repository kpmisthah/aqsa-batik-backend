import mongoose from "mongoose";

const HomeContentSchema = new mongoose.Schema(
  {
    sectionKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

const HomeContent = mongoose.model("HomeContent", HomeContentSchema);

export default HomeContent;
