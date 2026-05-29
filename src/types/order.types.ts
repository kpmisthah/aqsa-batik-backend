export interface IOrderItem {
  product: string;
  name: string;
  quantity: number;
  variantColour?: string;
  price: number;
}

export interface IShippingAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface IOrder {
  id?: string;
  _id?: string;
  user: any;
  items: IOrderItem[];
  totalAmount: number;
  shippingAddress: IShippingAddress;
  paymentGatewayOrderId?: string;
  paymentId?: string;
  paymentStatus: 'Pending' | 'Paid' | 'Failed';
  paymentMethod: 'Razorpay' | 'COD';
  orderStatus: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned';
  cancelReason?: string;
  returnReason?: string;
  returnStatus?: 'None' | 'Pending' | 'Approved' | 'Rejected';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrderDTO {
  user: string;
  items: IOrderItem[];
  totalAmount: number;
  shippingAddress: IShippingAddress;
  paymentGatewayOrderId?: string;
  paymentMethod?: 'Razorpay' | 'COD';
  paymentStatus?: 'Pending' | 'Paid' | 'Failed';
}

export interface UpdateOrderDTO {
  paymentGatewayOrderId?: string;
  paymentId?: string;
  paymentStatus?: 'Pending' | 'Paid' | 'Failed';
  orderStatus?: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned';
  cancelReason?: string;
  returnReason?: string;
  returnStatus?: 'None' | 'Pending' | 'Approved' | 'Rejected';
}
