import Product from '../models/Product.js';
import type { IProductRepository } from '../interfaces/IProductRepository.js';
import type { IProduct, CreateProductDTO, UpdateProductDTO } from '../types/product.types.js';

/**
 * Concrete implementation of IProductRepository using Mongoose (DIP)
 * If you ever switch from MongoDB to PostgreSQL, you only replace this file.
 */
import type { IBaseRepository, PaginatedResult } from '../interfaces/IBaseRepository.js';

class ProductRepository implements IProductRepository {
  async findAll(
    page: number = 1,
    limit: number = 10,
    admin: boolean = false,
    category?: string,
    search?: string,
    sort?: string,
    minPrice?: number,
    maxPrice?: number
  ): Promise<PaginatedResult<IProduct>> {
    const skip = (page - 1) * limit;
    
    const conditions: any[] = [];
    if (!admin) {
      conditions.push({ isBlocked: false });
    }

    if (category && category !== "All Categories") {
      if (category === "Wholesale") {
        conditions.push({
          $or: [
            { category: "Wholesale" },
            { isWholesale: true }
          ]
        });
      } else if (category.includes(',')) {
        const catArray = category.split(',').map(c => c.trim());
        conditions.push({ category: { $in: catArray } });
      } else {
        conditions.push({ category });
      }
    }

    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { subCategory: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { fabricDetails: { $regex: search, $options: 'i' } },
          { colours: { $regex: search, $options: 'i' } }
        ]
      });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: any = {};
      if (minPrice !== undefined) priceFilter.$gte = minPrice;
      if (maxPrice !== undefined) priceFilter.$lte = maxPrice;
      conditions.push({ discountPrice: priceFilter });
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    let sortObj: any = { createdAt: -1 };
    if (sort) {
      if (sort === 'price_asc') sortObj = { discountPrice: 1 };
      else if (sort === 'price_desc') sortObj = { discountPrice: -1 };
      else if (sort === 'oldest') sortObj = { createdAt: 1 };
      else if (sort === 'newest') sortObj = { createdAt: -1 };
    }

    const [data, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort(sortObj),
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

  async insertMany(productsData: CreateProductDTO[]): Promise<IProduct[]> {
    return await Product.insertMany(productsData) as unknown as IProduct[];
  }

  async update(id: string, updateData: UpdateProductDTO): Promise<IProduct | null> {
    return await Product.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id: string): Promise<IProduct | null> {
    return await Product.findByIdAndDelete(id);
  }

  async bulkUpdateInventory(updates: { id: string; quantity: number }[]): Promise<boolean> {
    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.id },
        update: { $set: { quantity: update.quantity } }
      }
    }));
    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }
    return true;
  }
}

export default new ProductRepository();
