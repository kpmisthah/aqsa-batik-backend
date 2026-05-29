import Product from '../models/Product.js';
import type { IProductRepository } from '../interfaces/IProductRepository.js';
import type { IProduct, CreateProductDTO, UpdateProductDTO } from '../types/product.types.js';

/**
 * Concrete implementation of IProductRepository using Mongoose (DIP)
 * If you ever switch from MongoDB to PostgreSQL, you only replace this file.
 */
import type { IBaseRepository, PaginatedResult } from '../interfaces/IBaseRepository.js';

class ProductRepository implements IProductRepository {
  async findAll(page: number = 1, limit: number = 10, admin: boolean = false): Promise<PaginatedResult<IProduct>> {
    const skip = (page - 1) * limit;
    const filter = admin ? {} : { isBlocked: false };
    const [data, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Product.countDocuments(filter)
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<IProduct | null> {
    return await Product.findById(id);
  }

  async create(productData: CreateProductDTO): Promise<IProduct> {
    const product = new Product(productData);
    return await product.save();
  }

  async update(id: string, updateData: UpdateProductDTO): Promise<IProduct | null> {
    return await Product.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id: string): Promise<IProduct | null> {
    return await Product.findByIdAndDelete(id);
  }
}

export default new ProductRepository();
