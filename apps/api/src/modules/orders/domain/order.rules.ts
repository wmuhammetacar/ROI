import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderStatus, ServiceType } from '@prisma/client';
import { APP_ROLES } from '../../../common/constants/roles';
import { AuthUser } from '../../../common/interfaces/auth-user.interface';

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: [OrderStatus.PLACED, OrderStatus.CANCELLED],
  PLACED: [OrderStatus.SENT_TO_STATION, OrderStatus.CANCELLED],
  SENT_TO_STATION: [OrderStatus.PREPARING],
  PREPARING: [OrderStatus.READY],
  READY: [OrderStatus.SERVED, OrderStatus.BILLED],
  SERVED: [OrderStatus.BILLED],
  BILLED: [OrderStatus.PAID],
  PAID: [],
  CANCELLED: [],
};

export function assertValidOrderTransition(current: OrderStatus, next: OrderStatus): void {
  if (current === next) {
    return;
  }

  const allowed = ORDER_STATUS_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new ConflictException(`Illegal order status transition: ${current} -> ${next}`);
  }
}

export function assertOrderEditable(status: OrderStatus): void {
  if (status !== OrderStatus.DRAFT && status !== OrderStatus.PLACED) {
    throw new ConflictException('Order items can only be modified while order is DRAFT or PLACED');
  }
}

export function assertOrderCancellable(status: OrderStatus): void {
  if (status !== OrderStatus.DRAFT && status !== OrderStatus.PLACED) {
    throw new ConflictException('Order can only be cancelled in DRAFT or PLACED state');
  }
}

export function assertServiceTypeMatchesTableSessionRules(
  serviceType: ServiceType,
  tableSessionId?: string,
): void {
  if (serviceType === ServiceType.DINE_IN && !tableSessionId) {
    throw new BadRequestException('DINE_IN orders must include tableSessionId');
  }
}

export function assertWaiterScope(user: AuthUser, serviceType: ServiceType): void {
  const isAdmin = user.roles.includes(APP_ROLES.ADMIN);
  const isCashier = user.roles.includes(APP_ROLES.CASHIER);
  const isWaiter = user.roles.includes(APP_ROLES.WAITER);

  const waiterOnly = isWaiter && !isAdmin && !isCashier;

  if (waiterOnly && serviceType !== ServiceType.DINE_IN) {
    throw new ForbiddenException('Waiter can manage only DINE_IN orders');
  }
}
