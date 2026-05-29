import type { IBaseRepository } from './IBaseRepository.js';
import type { IProduct, CreateProductDTO, UpdateProductDTO } from '../types/product.types.js';

/**
 * Product-specific repository interface (ISP)
 * Extends the base with any product-specific query methods.
 */
export interface IProductRepository extends IBaseRepository<IProduct, CreateProductDTO, UpdateProductDTO> {
  findAll(page?: number, limit?: number, admin?: boolean): Promise<PaginatedResult<IProduct>>;
}
