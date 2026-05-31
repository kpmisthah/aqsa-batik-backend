import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ['Admin', 'Wholesaler', 'Customer'],
      default: 'Customer',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Blocked', 'Pending'],
      default: 'Active',
    },
    lastLogin: {
      type: String,
      default: 'Never',
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      default: '',
    },
    zip: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    walletHistory: [
      {
        type: {
          type: String,
          enum: ['Credit', 'Debit'],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      }
    ],
  },
  {
    timestamps: true,
  }
);

// Map _id to id in JSON response
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete (ret as any)._id;
  }
});

const User = mongoose.model('User', userSchema);

export default User;
