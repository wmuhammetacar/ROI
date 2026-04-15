-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QUICK_SALE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PLACED', 'SENT_TO_STATION', 'PREPARING', 'READY', 'SERVED', 'BILLED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'VARIABLE');

-- CreateEnum
CREATE TYPE "ModifierSelectionType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "StationType" AS ENUM ('KITCHEN', 'BAR', 'DESSERT', 'PACKAGING', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductionTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionTicketItemStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "RegisterShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('COMPLETED', 'VOIDED', 'REFUNDED_PARTIAL', 'REFUNDED_FULL');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS', 'WASTE');

-- CreateEnum
CREATE TYPE "StockReferenceType" AS ENUM ('ORDER', 'PAYMENT', 'RECIPE_CONSUMPTION', 'MANUAL_ADJUSTMENT', 'WASTE_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationProviderType" AS ENUM ('MARKETPLACE', 'ONLINE_ORDERING', 'COURIER', 'OTHER');

-- CreateEnum
CREATE TYPE "BranchIntegrationConfigStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "ExternalOrderIngestionStatus" AS ENUM ('RECEIVED', 'NORMALIZED', 'CREATED_INTERNAL_ORDER', 'FAILED');

-- CreateEnum
CREATE TYPE "IntegrationSyncDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "IntegrationSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'RETRY_PENDING');

-- CreateEnum
CREATE TYPE "PublicOrderIdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "assignedWaiterId" TEXT,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "notes" TEXT,
    "billedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationProvider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" "IntegrationProviderType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchIntegrationConfig" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "BranchIntegrationConfigStatus" NOT NULL DEFAULT 'INACTIVE',
    "credentialsJson" JSONB,
    "settingsJson" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchIntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuMapping" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalItemId" TEXT NOT NULL,
    "externalItemName" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalOrder" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "externalStatus" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "normalizedJson" JSONB NOT NULL,
    "internalOrderId" TEXT,
    "ingestionStatus" "ExternalOrderIngestionStatus" NOT NULL DEFAULT 'RECEIVED',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncAttempt" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "direction" "IntegrationSyncDirection" NOT NULL,
    "operation" TEXT NOT NULL,
    "targetId" TEXT,
    "status" "IntegrationSyncStatus" NOT NULL,
    "requestPayloadJson" JSONB,
    "responsePayloadJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSyncAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicOrderIdempotency" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "clientSessionId" TEXT,
    "orderId" TEXT,
    "status" "PublicOrderIdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicOrderIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "stationId" TEXT,
    "variantNameSnapshot" TEXT,
    "baseProductPriceSnapshot" DECIMAL(12,2),
    "variantPriceDeltaSnapshot" DECIMAL(12,2),
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemModifierSelection" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "modifierGroupNameSnapshot" TEXT NOT NULL,
    "modifierOptionId" TEXT NOT NULL,
    "modifierOptionNameSnapshot" TEXT NOT NULL,
    "priceDeltaSnapshot" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItemModifierSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "UnitKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unitId" TEXT NOT NULL,
    "currentStock" DECIMAL(14,3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT,
    "productVariantId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "balanceBefore" DECIMAL(14,3) NOT NULL,
    "balanceAfter" DECIMAL(14,3) NOT NULL,
    "referenceType" "StockReferenceType" NOT NULL,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteRecord" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderConsumption" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterShift" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "openingCashAmount" DECIMAL(12,2) NOT NULL,
    "closingCashAmountExpected" DECIMAL(12,2),
    "closingCashAmountActual" DECIMAL(12,2),
    "varianceAmount" DECIMAL(12,2),
    "status" "RegisterShiftStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisterShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "registerShiftId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "referenceNo" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "imageUrl" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "productType" "ProductType" NOT NULL DEFAULT 'SIMPLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "priceDelta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "selectionType" "ModifierSelectionType" NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierOption" (
    "id" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModifierGroupLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductModifierGroupLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchPriceOverride" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchPriceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stationType" "StationType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStationRoute" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStationRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTicket" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tableSessionId" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "status" "ProductionTicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTicketItem" (
    "id" TEXT NOT NULL,
    "productionTicketId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "variantNameSnapshot" TEXT,
    "notesSnapshot" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "status" "ProductionTicketItemStatus" NOT NULL DEFAULT 'QUEUED',
    "firedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "Floor_branchId_sortOrder_idx" ON "Floor"("branchId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_branchId_name_key" ON "Floor"("branchId", "name");

-- CreateIndex
CREATE INDEX "Table_branchId_floorId_idx" ON "Table"("branchId", "floorId");

-- CreateIndex
CREATE INDEX "Table_branchId_status_idx" ON "Table"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Table_branchId_name_key" ON "Table"("branchId", "name");

-- CreateIndex
CREATE INDEX "TableSession_branchId_tableId_status_idx" ON "TableSession"("branchId", "tableId", "status");

-- CreateIndex
CREATE INDEX "TableSession_openedByUserId_idx" ON "TableSession"("openedByUserId");

-- CreateIndex
CREATE INDEX "TableSession_assignedWaiterId_idx" ON "TableSession"("assignedWaiterId");

-- CreateIndex
CREATE INDEX "Order_branchId_status_serviceType_idx" ON "Order"("branchId", "status", "serviceType");

-- CreateIndex
CREATE INDEX "Order_tableSessionId_idx" ON "Order"("tableSessionId");

-- CreateIndex
CREATE INDEX "Order_createdByUserId_idx" ON "Order"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_branchId_orderNumber_key" ON "Order"("branchId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationProvider_code_key" ON "IntegrationProvider"("code");

-- CreateIndex
CREATE INDEX "IntegrationProvider_isActive_providerType_idx" ON "IntegrationProvider"("isActive", "providerType");

-- CreateIndex
CREATE INDEX "BranchIntegrationConfig_branchId_status_updatedAt_idx" ON "BranchIntegrationConfig"("branchId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "BranchIntegrationConfig_providerId_status_idx" ON "BranchIntegrationConfig"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BranchIntegrationConfig_branchId_providerId_key" ON "BranchIntegrationConfig"("branchId", "providerId");

-- CreateIndex
CREATE INDEX "MenuMapping_branchId_providerId_isActive_idx" ON "MenuMapping"("branchId", "providerId", "isActive");

-- CreateIndex
CREATE INDEX "MenuMapping_productId_variantId_idx" ON "MenuMapping"("productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuMapping_branchId_providerId_externalItemId_key" ON "MenuMapping"("branchId", "providerId", "externalItemId");

-- CreateIndex
CREATE INDEX "ExternalOrder_branchId_providerId_ingestionStatus_createdAt_idx" ON "ExternalOrder"("branchId", "providerId", "ingestionStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ExternalOrder_internalOrderId_idx" ON "ExternalOrder"("internalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrder_branchId_providerId_externalOrderId_key" ON "ExternalOrder"("branchId", "providerId", "externalOrderId");

-- CreateIndex
CREATE INDEX "IntegrationSyncAttempt_branchId_providerId_direction_create_idx" ON "IntegrationSyncAttempt"("branchId", "providerId", "direction", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationSyncAttempt_branchId_providerId_status_createdAt_idx" ON "IntegrationSyncAttempt"("branchId", "providerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PublicOrderIdempotency_branchId_createdAt_idx" ON "PublicOrderIdempotency"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "PublicOrderIdempotency_orderId_idx" ON "PublicOrderIdempotency"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicOrderIdempotency_branchId_idempotencyKey_key" ON "PublicOrderIdempotency"("branchId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_status_idx" ON "OrderItem"("orderId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_productId_variantId_idx" ON "OrderItem"("productId", "variantId");

-- CreateIndex
CREATE INDEX "OrderItem_stationId_idx" ON "OrderItem"("stationId");

-- CreateIndex
CREATE INDEX "OrderItemModifierSelection_orderItemId_createdAt_idx" ON "OrderItemModifierSelection"("orderItemId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItemModifierSelection_modifierGroupId_modifierOptionId_idx" ON "OrderItemModifierSelection"("modifierGroupId", "modifierOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemModifierSelection_orderItemId_modifierGroupId_modi_key" ON "OrderItemModifierSelection"("orderItemId", "modifierGroupId", "modifierOptionId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_actorUserId_idx" ON "OrderEvent"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_code_key" ON "UnitOfMeasure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_name_key" ON "UnitOfMeasure"("name");

-- CreateIndex
CREATE INDEX "Ingredient_branchId_isActive_name_idx" ON "Ingredient"("branchId", "isActive", "name");

-- CreateIndex
CREATE INDEX "Ingredient_unitId_idx" ON "Ingredient"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_branchId_name_key" ON "Ingredient"("branchId", "name");

-- CreateIndex
CREATE INDEX "Recipe_branchId_isActive_createdAt_idx" ON "Recipe"("branchId", "isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_branchId_productId_key" ON "Recipe"("branchId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_branchId_productVariantId_key" ON "Recipe"("branchId", "productVariantId");

-- CreateIndex
CREATE INDEX "RecipeItem_ingredientId_idx" ON "RecipeItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_recipeId_ingredientId_key" ON "RecipeItem"("recipeId", "ingredientId");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_createdAt_idx" ON "StockMovement"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_ingredientId_createdAt_idx" ON "StockMovement"("ingredientId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_movementType_createdAt_idx" ON "StockMovement"("branchId", "movementType", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_referenceType_referenceId_idx" ON "StockMovement"("branchId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "StockMovement_createdByUserId_idx" ON "StockMovement"("createdByUserId");

-- CreateIndex
CREATE INDEX "WasteRecord_branchId_ingredientId_createdAt_idx" ON "WasteRecord"("branchId", "ingredientId", "createdAt");

-- CreateIndex
CREATE INDEX "WasteRecord_createdByUserId_idx" ON "WasteRecord"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderConsumption_orderId_key" ON "OrderConsumption"("orderId");

-- CreateIndex
CREATE INDEX "OrderConsumption_branchId_consumedAt_idx" ON "OrderConsumption"("branchId", "consumedAt");

-- CreateIndex
CREATE INDEX "RegisterShift_branchId_status_openedAt_idx" ON "RegisterShift"("branchId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "RegisterShift_branchId_openedByUserId_status_idx" ON "RegisterShift"("branchId", "openedByUserId", "status");

-- CreateIndex
CREATE INDEX "RegisterShift_openedByUserId_status_idx" ON "RegisterShift"("openedByUserId", "status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_branchId_orderId_createdAt_idx" ON "PaymentTransaction"("branchId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_registerShiftId_createdAt_idx" ON "PaymentTransaction"("registerShiftId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_branchId_paymentMethod_status_createdAt_idx" ON "PaymentTransaction"("branchId", "paymentMethod", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_createdByUserId_idx" ON "PaymentTransaction"("createdByUserId");

-- CreateIndex
CREATE INDEX "Refund_branchId_orderId_createdAt_idx" ON "Refund"("branchId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_paymentTransactionId_createdAt_idx" ON "Refund"("paymentTransactionId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_createdByUserId_idx" ON "Refund"("createdByUserId");

-- CreateIndex
CREATE INDEX "Category_branchId_isActive_idx" ON "Category"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "Category_branchId_sortOrder_createdAt_idx" ON "Category"("branchId", "sortOrder", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_branchId_name_key" ON "Category"("branchId", "name");

-- CreateIndex
CREATE INDEX "Product_branchId_categoryId_idx" ON "Product"("branchId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_branchId_isActive_isAvailable_idx" ON "Product"("branchId", "isActive", "isAvailable");

-- CreateIndex
CREATE INDEX "Product_branchId_sortOrder_createdAt_idx" ON "Product"("branchId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "Product_branchId_name_idx" ON "Product"("branchId", "name");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_sortOrder_createdAt_idx" ON "ProductVariant"("productId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_name_key" ON "ProductVariant"("productId", "name");

-- CreateIndex
CREATE INDEX "ModifierGroup_branchId_isActive_idx" ON "ModifierGroup"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "ModifierGroup_branchId_sortOrder_createdAt_idx" ON "ModifierGroup"("branchId", "sortOrder", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModifierGroup_branchId_name_key" ON "ModifierGroup"("branchId", "name");

-- CreateIndex
CREATE INDEX "ModifierOption_modifierGroupId_sortOrder_createdAt_idx" ON "ModifierOption"("modifierGroupId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "ModifierOption_modifierGroupId_isActive_idx" ON "ModifierOption"("modifierGroupId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ModifierOption_modifierGroupId_name_key" ON "ModifierOption"("modifierGroupId", "name");

-- CreateIndex
CREATE INDEX "ProductModifierGroupLink_productId_sortOrder_createdAt_idx" ON "ProductModifierGroupLink"("productId", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "ProductModifierGroupLink_modifierGroupId_idx" ON "ProductModifierGroupLink"("modifierGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModifierGroupLink_productId_modifierGroupId_key" ON "ProductModifierGroupLink"("productId", "modifierGroupId");

-- CreateIndex
CREATE INDEX "BranchPriceOverride_branchId_productId_idx" ON "BranchPriceOverride"("branchId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchPriceOverride_branchId_productId_variantId_key" ON "BranchPriceOverride"("branchId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "Station_branchId_stationType_isActive_idx" ON "Station"("branchId", "stationType", "isActive");

-- CreateIndex
CREATE INDEX "Station_branchId_sortOrder_createdAt_idx" ON "Station"("branchId", "sortOrder", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Station_branchId_name_key" ON "Station"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Station_branchId_code_key" ON "Station"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStationRoute_productId_key" ON "ProductStationRoute"("productId");

-- CreateIndex
CREATE INDEX "ProductStationRoute_branchId_stationId_idx" ON "ProductStationRoute"("branchId", "stationId");

-- CreateIndex
CREATE INDEX "ProductStationRoute_branchId_productId_idx" ON "ProductStationRoute"("branchId", "productId");

-- CreateIndex
CREATE INDEX "ProductionTicket_branchId_stationId_status_createdAt_idx" ON "ProductionTicket"("branchId", "stationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductionTicket_orderId_createdAt_idx" ON "ProductionTicket"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductionTicket_tableSessionId_idx" ON "ProductionTicket"("tableSessionId");

-- CreateIndex
CREATE INDEX "ProductionTicketItem_branchId_stationId_status_firedAt_idx" ON "ProductionTicketItem"("branchId", "stationId", "status", "firedAt");

-- CreateIndex
CREATE INDEX "ProductionTicketItem_productionTicketId_status_createdAt_idx" ON "ProductionTicketItem"("productionTicketId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductionTicketItem_orderId_status_idx" ON "ProductionTicketItem"("orderId", "status");

-- CreateIndex
CREATE INDEX "ProductionTicketItem_orderItemId_idx" ON "ProductionTicketItem"("orderItemId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_assignedWaiterId_fkey" FOREIGN KEY ("assignedWaiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchIntegrationConfig" ADD CONSTRAINT "BranchIntegrationConfig_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchIntegrationConfig" ADD CONSTRAINT "BranchIntegrationConfig_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMapping" ADD CONSTRAINT "MenuMapping_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMapping" ADD CONSTRAINT "MenuMapping_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMapping" ADD CONSTRAINT "MenuMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMapping" ADD CONSTRAINT "MenuMapping_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalOrder" ADD CONSTRAINT "ExternalOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalOrder" ADD CONSTRAINT "ExternalOrder_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalOrder" ADD CONSTRAINT "ExternalOrder_internalOrderId_fkey" FOREIGN KEY ("internalOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncAttempt" ADD CONSTRAINT "IntegrationSyncAttempt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncAttempt" ADD CONSTRAINT "IntegrationSyncAttempt_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrderIdempotency" ADD CONSTRAINT "PublicOrderIdempotency_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrderIdempotency" ADD CONSTRAINT "PublicOrderIdempotency_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifierSelection" ADD CONSTRAINT "OrderItemModifierSelection_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsumption" ADD CONSTRAINT "OrderConsumption_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderConsumption" ADD CONSTRAINT "OrderConsumption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_registerShiftId_fkey" FOREIGN KEY ("registerShiftId") REFERENCES "RegisterShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModifierGroupLink" ADD CONSTRAINT "ProductModifierGroupLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModifierGroupLink" ADD CONSTRAINT "ProductModifierGroupLink_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchPriceOverride" ADD CONSTRAINT "BranchPriceOverride_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchPriceOverride" ADD CONSTRAINT "BranchPriceOverride_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchPriceOverride" ADD CONSTRAINT "BranchPriceOverride_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStationRoute" ADD CONSTRAINT "ProductStationRoute_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStationRoute" ADD CONSTRAINT "ProductStationRoute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStationRoute" ADD CONSTRAINT "ProductStationRoute_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicket" ADD CONSTRAINT "ProductionTicket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicket" ADD CONSTRAINT "ProductionTicket_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicket" ADD CONSTRAINT "ProductionTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicket" ADD CONSTRAINT "ProductionTicket_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicketItem" ADD CONSTRAINT "ProductionTicketItem_productionTicketId_fkey" FOREIGN KEY ("productionTicketId") REFERENCES "ProductionTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicketItem" ADD CONSTRAINT "ProductionTicketItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicketItem" ADD CONSTRAINT "ProductionTicketItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicketItem" ADD CONSTRAINT "ProductionTicketItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTicketItem" ADD CONSTRAINT "ProductionTicketItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

