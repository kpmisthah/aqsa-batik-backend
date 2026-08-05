import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, default: '' },
    content: { type: String, required: true },
    featuredImg: { type: String, default: '' },
    published: { type: Boolean, default: false },
    author: { type: String, default: '' },
    metaTitle: { type: String, default: '' },
    metaDesc: { type: String, default: '' },
    category: { type: String, default: '' },
  },
  { timestamps: true }
);

blogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete (ret as any)._id;
  }
});

const Blog = mongoose.model('Blog', blogSchema);
export default Blog;
