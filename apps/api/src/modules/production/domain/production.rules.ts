import { ConflictException } from '@nestjs/common';
import {
  OrderStatus,
  ProductionTicketItemStatus,
  ProductionTicketStatus,
} from '@prisma/client';

const PRODUCTION_ITEM_TRANSITIONS: Record<
  ProductionTicketItemStatus,
  ProductionTicketItemStatus[]
> = {
  QUEUED: [ProductionTicketItemStatus.IN_PROGRESS, ProductionTicketItemStatus.CANCELLED],
  IN_PROGRESS: [ProductionTicketItemStatus.READY, ProductionTicketItemStatus.CANCELLED],
  READY: [ProductionTicketItemStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertValidProductionTicketItemTransition(
  current: ProductionTicketItemStatus,
  next: ProductionTicketItemStatus,
): void {
  if (current === next) {
    return;
  }

  const allowed = PRODUCTION_ITEM_TRANSITIONS[current];

  if (!allowed.includes(next)) {
    throw new ConflictException(
      `Illegal production ticket item transition: ${current} -> ${next}`,
    );
  }
}

export function deriveProductionTicketStatus(
  statuses: ProductionTicketItemStatus[],
): ProductionTicketStatus {
  if (statuses.length === 0) {
    return ProductionTicketStatus.OPEN;
  }

  const activeStatuses = statuses.filter((status) => status !== ProductionTicketItemStatus.CANCELLED);

  if (activeStatuses.length === 0) {
    return ProductionTicketStatus.CANCELLED;
  }

  if (activeStatuses.every((status) => status === ProductionTicketItemStatus.QUEUED)) {
    return ProductionTicketStatus.OPEN;
  }

  if (activeStatuses.some((status) => status === ProductionTicketItemStatus.IN_PROGRESS)) {
    return ProductionTicketStatus.IN_PROGRESS;
  }

  if (activeStatuses.every((status) => status === ProductionTicketItemStatus.COMPLETED)) {
    return ProductionTicketStatus.COMPLETED;
  }

  const allReadyOrCompleted = activeStatuses.every(
    (status) =>
      status === ProductionTicketItemStatus.READY ||
      status === ProductionTicketItemStatus.COMPLETED,
  );

  if (allReadyOrCompleted && activeStatuses.some((status) => status === ProductionTicketItemStatus.READY)) {
    return ProductionTicketStatus.READY;
  }

  return ProductionTicketStatus.IN_PROGRESS;
}

export function deriveOrderStatusFromProduction(
  currentStatus: OrderStatus,
  itemStatuses: ProductionTicketItemStatus[],
): OrderStatus | null {
  const activeStatuses = itemStatuses.filter((status) => status !== ProductionTicketItemStatus.CANCELLED);

  if (activeStatuses.length === 0) {
    return null;
  }

  const hasInProgress = activeStatuses.some(
    (status) => status === ProductionTicketItemStatus.IN_PROGRESS,
  );

  if (hasInProgress && currentStatus === OrderStatus.SENT_TO_STATION) {
    return OrderStatus.PREPARING;
  }

  const allReadyOrCompleted = activeStatuses.every(
    (status) =>
      status === ProductionTicketItemStatus.READY ||
      status === ProductionTicketItemStatus.COMPLETED,
  );

  if (
    allReadyOrCompleted &&
    (currentStatus === OrderStatus.SENT_TO_STATION || currentStatus === OrderStatus.PREPARING)
  ) {
    return OrderStatus.READY;
  }

  return null;
}
