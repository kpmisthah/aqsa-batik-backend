import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    subCategory: {
      type: String,
    },
    images: {
      type: [String],
      required: true,
    },
    colours: {
      type: [String],
      default: [],
    },
    fabricDetails: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    fullPrice: {
      type: Number,
      required: true,
    },
    discountPrice: {
      type: Number,
      required: true,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    isWholesale: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    seoTitle: {
      type: String,
      default: '',
    },
    metaDescription: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    sku: {
      type: String,
      default: '',
    },
    slug: {
      type: String,
      default: '',
    },
    pattern: {
      type: String,
      default: '',
    },
    fabric: {
      type: String,
      default: '',
    },
    careInstructions: {
      type: String,
      default: '',
    },
    fabricQuality: {
      type: String,
      default: '',
    },
    kameezLength: {
      type: String,
      default: '',
    },
    shalwarLength: {
      type: String,
      default: '',
    },
    dupattaLength: {
      type: String,
      default: '',
    },
    discountPercentage: {
      type: String,
      default: '',
    },
    stockStatus: {
      type: String,
      default: '',
    },
    altText: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    minWholesaleQuantity: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Map _id to id in JSON response
productSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete (ret as any)._id;
  }
});

const Product = mongoose.model('Product', productSchema);

export default Product;
