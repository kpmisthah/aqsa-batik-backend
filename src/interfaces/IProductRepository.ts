import type { IBaseRepository, PaginatedResult } from './IBaseRepository.js';
import type { IProduct, CreateProductDTO, UpdateProductDTO } from '../types/product.types.js';

/**
 * Product-specific repository interface (ISP)
 * Extends the base with any product-specific query methods.
 */
export interface IProductRepository extends IBaseRepository<IProduct, CreateProductDTO, UpdateProductDTO> {
  findAll(page?: number, limit?: number, admin?: boolean, category?: string, search?: string, sort?: string, minPrice?: number, maxPrice?: number): Promise<PaginatedResult<IProduct>>;
  insertMany(data: CreateProductDTO[]): Promise<IProduct[]>;
}

