export interface IProduct {
  id?: string;
  name: string;
  category: string;
  subCategory?: string | null;
  images: string[];
  colours: string[];
  fabricDetails: string;
  quantity: number;
  fullPrice: number;
  discountPrice: number;
  isBestSeller: boolean;
  isWholesale: boolean;
  isBlocked: boolean;
  seoTitle?: string | null;
  metaDescription?: string | null;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateProductDTO {
  name: string;
  category: string;
  subCategory?: string;
  images: string[];
  colours: string[];
  fabricDetails: string;
  quantity: number;
  fullPrice: number;
  discountPrice: number;
  isBestSeller?: boolean;
  isWholesale?: boolean;
  seoTitle?: string;
  metaDescription?: string;
  description?: string;
}

export interface UpdateProductDTO {
  name?: string;
  category?: string;
  subCategory?: string;
  images?: string[];
  colours?: string[];
  fabricDetails?: string;
  quantity?: number;
  fullPrice?: number;
  discountPrice?: number;
  isBestSeller?: boolean;
  isWholesale?: boolean;
  isBlocked?: boolean;
  seoTitle?: string;
  metaDescription?: string;
  description?: string;
}
