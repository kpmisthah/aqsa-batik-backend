import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        variantColour: { type: String, default: '' },
        price: { type: Number, required: true }, // price at purchase in INR
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    shippingAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      phone: { type: String, required: true },
    },
    paymentGatewayOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paymentId: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      enum: ['Razorpay', 'COD', 'Wallet'],
      default: 'Razorpay',
    },
    orderStatus: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
      default: 'Pending',
    },
    cancelReason: {
      type: String,
      default: '',
    },
    returnReason: {
      type: String,
      default: '',
    },
    returnStatus: {
      type: String,
      enum: ['None', 'Pending', 'Approved', 'Rejected'],
      default: 'None',
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.virtual('status')
  .get(function(this: any) {
    return this.orderStatus;
  })
  .set(function(this: any, val: string) {
    this.orderStatus = val;
  });

orderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete (ret as any)._id;
  },
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
