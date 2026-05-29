import Order from '../models/Order.js';
import type { IOrderRepository } from '../interfaces/IOrderRepository.js';
import type { IOrder, CreateOrderDTO, UpdateOrderDTO } from '../types/order.types.js';
import type { PaginatedResult } from '../interfaces/IBaseRepository.js';

class OrderRepository implements IOrderRepository {
  async findAll(page?: number, limit?: number): Promise<PaginatedResult<IOrder>> {
    if (page === undefined || limit === undefined) {
      const data = await Order.find({}).populate('user', 'name email').sort({ createdAt: -1 });
      const total = data.length;
      return {
        data: data as any[],
        total,
        page: 1,
        limit: total,
        totalPages: 1
      };
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Order.find({}).populate('user', 'name email').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Order.countDocuments({})
    ]);
    return { data: data as any[], total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<IOrder | null> {
    return await Order.findById(id).populate('user', 'name email') as any;
  }

  async create(orderData: CreateOrderDTO): Promise<IOrder> {
    const order = new Order(orderData);
    const savedOrder = await order.save();
    return await savedOrder.populate('user', 'name email') as any;
  }

  async update(id: string, updateData: UpdateOrderDTO): Promise<IOrder | null> {
    return await Order.findByIdAndUpdate(id, updateData, { new: true }).populate('user', 'name email') as any;
  }

  async delete(id: string): Promise<IOrder | null> {
    return await Order.findByIdAndDelete(id) as any;
  }

  async findByUser(userId: string): Promise<IOrder[]> {
    return await Order.find({ user: userId }).sort({ createdAt: -1 }) as any[];
  }

  async findByPaymentGatewayOrderId(gatewayOrderId: string): Promise<IOrder | null> {
    return await Order.findOne({ paymentGatewayOrderId: gatewayOrderId }).populate('user', 'name email') as any;
  }
}

export default new OrderRepository();
