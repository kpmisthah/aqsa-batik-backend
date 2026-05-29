import type { IProductRepository } from '../interfaces/IProductRepository.js';
import type { IProduct, CreateProductDTO, UpdateProductDTO } from '../types/product.types.js';

/**
 * ProductService - Business logic layer (SRP)
 * Controllers handle HTTP concerns, this service handles business rules.
 * Depends on IProductRepository interface, not the concrete class (DIP).
 */
import type { PaginatedResult } from '../interfaces/IBaseRepository.js';

class ProductService {
  constructor(private readonly productRepository: IProductRepository) {}

  async getAllProducts(page: number = 1, limit: number = 10, admin: boolean = false): Promise<PaginatedResult<IProduct>> {
    return await this.productRepository.findAll(page, limit, admin);
  }

  async getProductById(id: string): Promise<IProduct | null> {
    return await this.productRepository.findById(id);
  }

  async createProduct(data: CreateProductDTO): Promise<IProduct> {
    // Business validation can go here
    return await this.productRepository.create(data);
  }

  async updateProduct(id: string, data: UpdateProductDTO): Promise<IProduct | null> {
    return await this.productRepository.update(id, data);
  }

  async toggleBlockProduct(id: string): Promise<IProduct | null> {
    const product = await this.productRepository.findById(id);
    if (!product) return null;
    return await this.productRepository.update(id, { isBlocked: !product.isBlocked });
  }

  async deleteProduct(id: string): Promise<IProduct | null> {
    return await this.productRepository.delete(id);
  }
}

export default ProductService;
