export interface IBlog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImg?: string;
  published: boolean;
  author?: string;
  metaTitle?: string;
  metaDesc?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateBlogDTO = Omit<IBlog, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateBlogDTO = Partial<CreateBlogDTO>;
