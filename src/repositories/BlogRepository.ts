import Blog from '../models/Blog.js';
import type { IBlog, CreateBlogDTO, UpdateBlogDTO } from '../types/blog.types.js';

class BlogRepository {
  async findAll(admin: boolean = false): Promise<IBlog[]> {
    const filter = admin ? {} : { published: true };
    return await Blog.find(filter).sort({ createdAt: -1 }) as any;
  }

  async findById(id: string): Promise<IBlog | null> {
    return await Blog.findById(id) as any;
  }

  async findBySlug(slug: string): Promise<IBlog | null> {
    return await Blog.findOne({ slug }) as any;
  }

  async create(blogData: CreateBlogDTO): Promise<IBlog> {
    const blog = new Blog(blogData);
    return await blog.save() as any;
  }

  async update(id: string, updateData: UpdateBlogDTO): Promise<IBlog | null> {
    return await Blog.findByIdAndUpdate(id, updateData, { new: true }) as any;
  }

  async delete(id: string): Promise<IBlog | null> {
    return await Blog.findByIdAndDelete(id) as any;
  }
}

export default new BlogRepository();
