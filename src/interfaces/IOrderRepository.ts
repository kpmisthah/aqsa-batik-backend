import type { IBaseRepository } from './IBaseRepository.js';
import type { IOrder, CreateOrderDTO, UpdateOrderDTO } from '../types/order.types.js';

export interface IOrderRepository extends IBaseRepository<IOrder, CreateOrderDTO, UpdateOrderDTO> {
  findByUser(userId: string): Promise<IOrder[]>;
  findByPaymentGatewayOrderId(gatewayOrderId: string): Promise<IOrder | null>;
}
