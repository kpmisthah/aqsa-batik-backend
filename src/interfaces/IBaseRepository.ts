/**
 * Generic base repository interface (DIP + ISP)
 * All repositories implement this contract, making them interchangeable.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IBaseRepository<T, CreateDTO, UpdateDTO> {
  findAll(page?: number, limit?: number): Promise<PaginatedResult<T>>;
  findById(id: string): Promise<T | null>;
  create(data: CreateDTO): Promise<T>;
  update(id: string, data: UpdateDTO): Promise<T | null>;
  delete(id: string): Promise<T | null>;
}
