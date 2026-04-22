import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderItemStatus,
  OrderStatus,
  Prisma,
  StockMovementType,
  StockReferenceType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ORDER_EVENT_TYPES } from '../orders/domain/order-events.constants';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { CreateRecipeItemDto } from './dto/create-recipe-item.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { GetInventorySummaryDto } from './dto/get-inventory-summary.dto';
import { ListIngredientStockMovementsDto } from './dto/list-ingredient-stock-movements.dto';
import { ListIngredientWasteRecordsDto } from './dto/list-ingredient-waste-records.dto';
import { ListIngredientsDto } from './dto/list-ingredients.dto';
import { ListRecipesDto } from './dto/list-recipes.dto';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';
import { UpdateIngredientActiveStateDto } from './dto/update-ingredient-active-state.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { UpdateRecipeItemDto } from './dto/update-recipe-item.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import {
  assertRecipeTargetExclusive,
  normalizeCode,
  normalizeName,
  resolveMovementTypeFromAdjustment,
} from './domain/inventory.rules';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createUnit(actorUserId: string, dto: CreateUnitDto) {
    const name = normalizeName(dto.name);
    const code = normalizeCode(dto.code);

    const duplicate = await this.prisma.unitOfMeasure.findFirst({
      where: {
        OR: [{ name }, { code }],
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new ConflictException('Unit name or code already exists');
    }

    const unit = await this.prisma.unitOfMeasure.create({
      data: {
        name,
        code,
        kind: dto.kind,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_UNIT',
      entity: 'unit',
      metadata: {
        unitId: unit.id,
      },
    });

    return unit;
  }

  async listUnits() {
    return this.prisma.unitOfMeasure.findMany({
      orderBy: [{ name: 'asc' }],
    });
  }

  async getUnitById(unitId: string) {
    const unit = await this.prisma.unitOfMeasure.findUnique({
      where: {
        id: unitId,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    return unit;
  }

  async updateUnit(unitId: string, actorUserId: string, dto: UpdateUnitDto) {
    const unit = await this.getUnitById(unitId);

    const updateData: Prisma.UnitOfMeasureUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = normalizeName(dto.name);
    }

    if (dto.code !== undefined) {
      updateData.code = normalizeCode(dto.code);
    }

    if (dto.kind !== undefined) {
      updateData.kind = dto.kind;
    }

    if (Object.keys(updateData).length === 0) {
      return unit;
    }

    if (updateData.name || updateData.code) {
      const duplicateConditions: Prisma.UnitOfMeasureWhereInput[] = [];

      if (updateData.name) {
        duplicateConditions.push({ name: updateData.name as string });
      }

      if (updateData.code) {
        duplicateConditions.push({ code: updateData.code as string });
      }

      const duplicate = await this.prisma.unitOfMeasure.findFirst({
        where: {
          id: { not: unit.id },
          OR: duplicateConditions,
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new ConflictException('Unit name or code already exists');
      }
    }

    const updated = await this.prisma.unitOfMeasure.update({
      where: {
        id: unit.id,
      },
      data: updateData,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_UNIT',
      entity: 'unit',
      metadata: {
        unitId: unit.id,
        changes: {
          name: dto.name !== undefined ? normalizeName(dto.name) : undefined,
          code: dto.code !== undefined ? normalizeCode(dto.code) : undefined,
          kind: dto.kind,
        },
      },
    });

    return updated;
  }

  async deleteUnit(unitId: string, actorUserId: string) {
    const unit = await this.getUnitById(unitId);

    const ingredientCount = await this.prisma.ingredient.count({
      where: {
        unitId: unit.id,
      },
    });

    if (ingredientCount > 0) {
      throw new ConflictException('Cannot delete unit referenced by ingredients');
    }

    await this.prisma.unitOfMeasure.delete({
      where: {
        id: unit.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_UNIT',
      entity: 'unit',
      metadata: {
        unitId: unit.id,
      },
    });

    return {
      message: 'Unit deleted successfully',
    };
  }

  async createIngredient(branchId: string, actorUserId: string, dto: CreateIngredientDto) {
    const unit = await this.ensureUnitExists(dto.unitId);
    const name = normalizeName(dto.name);
    const sku = dto.sku ? normalizeCode(dto.sku) : null;

    const duplicateByName = await this.prisma.ingredient.findFirst({
      where: {
        branchId,
        name,
      },
      select: {
        id: true,
      },
    });

    if (duplicateByName) {
      throw new ConflictException('Ingredient name already exists in this branch');
    }

    const ingredient = await this.prisma.ingredient.create({
      data: {
        branchId,
        name,
        sku,
        unitId: unit.id,
        currentStock: new Prisma.Decimal(dto.currentStock),
        lowStockThreshold: new Prisma.Decimal(dto.lowStockThreshold ?? 0),
        isActive: dto.isActive ?? true,
      },
      include: {
        unit: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_INGREDIENT',
      entity: 'ingredient',
      metadata: {
        ingredientId: ingredient.id,
        branchId,
      },
    });

    return ingredient;
  }

  async listIngredients(branchId: string, query: ListIngredientsDto) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        branchId,
        isActive: query.isActive,
        OR: query.q?.trim()
          ? [
              { name: { contains: query.q.trim(), mode: 'insensitive' } },
              { sku: { contains: query.q.trim(), mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        unit: true,
      },
      orderBy: [{ name: 'asc' }],
      take: query.lowStockOnly ? 1000 : query.limit,
    });

    if (!query.lowStockOnly) {
      return ingredients;
    }

    return ingredients
      .filter((ingredient) => this.isLowStock(ingredient.currentStock, ingredient.lowStockThreshold))
      .slice(0, query.limit);
  }

  async getIngredientById(branchId: string, ingredientId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: {
        id: ingredientId,
        branchId,
      },
      include: {
        unit: true,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    return ingredient;
  }

  async updateIngredient(branchId: string, ingredientId: string, actorUserId: string, dto: UpdateIngredientDto) {
    const ingredient = await this.getIngredientById(branchId, ingredientId);

    const updateData: Prisma.IngredientUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = normalizeName(dto.name);
    }

    if (dto.sku !== undefined) {
      updateData.sku = dto.sku ? normalizeCode(dto.sku) : null;
    }

    if (dto.unitId !== undefined) {
      const unit = await this.ensureUnitExists(dto.unitId);
      updateData.unit = {
        connect: {
          id: unit.id,
        },
      };
    }

    if (dto.lowStockThreshold !== undefined) {
      updateData.lowStockThreshold = new Prisma.Decimal(dto.lowStockThreshold);
    }

    if (Object.keys(updateData).length === 0) {
      return ingredient;
    }

    if (updateData.name && updateData.name !== ingredient.name) {
      const duplicate = await this.prisma.ingredient.findFirst({
        where: {
          branchId,
          name: updateData.name as string,
          id: {
            not: ingredient.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new ConflictException('Ingredient name already exists in this branch');
      }
    }

    const updated = await this.prisma.ingredient.update({
      where: {
        id: ingredient.id,
      },
      data: updateData,
      include: {
        unit: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_INGREDIENT',
      entity: 'ingredient',
      metadata: {
        ingredientId: ingredient.id,
        branchId,
        changes: {
          name: updateData.name,
          sku: updateData.sku,
          unitId: dto.unitId,
          lowStockThreshold:
            dto.lowStockThreshold !== undefined ? new Prisma.Decimal(dto.lowStockThreshold).toString() : undefined,
        },
      },
    });

    return updated;
  }

  async deleteIngredient(branchId: string, ingredientId: string, actorUserId: string) {
    const ingredient = await this.getIngredientById(branchId, ingredientId);

    const [recipeItemCount, movementCount] = await Promise.all([
      this.prisma.recipeItem.count({
        where: {
          ingredientId: ingredient.id,
        },
      }),
      this.prisma.stockMovement.count({
        where: {
          ingredientId: ingredient.id,
        },
      }),
    ]);

    if (recipeItemCount > 0 || movementCount > 0) {
      throw new ConflictException('Cannot delete ingredient referenced by recipes or stock history');
    }

    await this.prisma.ingredient.delete({
      where: {
        id: ingredient.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_INGREDIENT',
      entity: 'ingredient',
      metadata: {
        ingredientId: ingredient.id,
        branchId,
      },
    });

    return {
      message: 'Ingredient deleted successfully',
    };
  }

  async updateIngredientActiveState(
    branchId: string,
    ingredientId: string,
    actorUserId: string,
    dto: UpdateIngredientActiveStateDto,
  ) {
    const ingredient = await this.getIngredientById(branchId, ingredientId);

    const updated = await this.prisma.ingredient.update({
      where: {
        id: ingredient.id,
      },
      data: {
        isActive: dto.isActive,
      },
      include: {
        unit: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_INGREDIENT_ACTIVE_STATE',
      entity: 'ingredient',
      metadata: {
        ingredientId: ingredient.id,
        branchId,
        isActive: dto.isActive,
      },
    });

    return updated;
  }

  async adjustIngredientStock(branchId: string, ingredientId: string, actorUserId: string, dto: AdjustStockDto) {
    const quantity = new Prisma.Decimal(dto.quantity);

    const result = await this.prisma.$transaction(async (tx) => {
      const movementType = resolveMovementTypeFromAdjustment(dto.adjustmentType);

      const movement = await this.applyIngredientMovementTx(tx, {
        branchId,
        ingredientId,
        movementType,
        quantity,
        referenceType: StockReferenceType.MANUAL_ADJUSTMENT,
        referenceId: null,
        notes: dto.notes,
        createdByUserId: actorUserId,
      });

      return movement;
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'ADJUST_STOCK',
      entity: 'ingredient',
      metadata: {
        ingredientId,
        branchId,
        movementType: result.movement.movementType,
        quantity: quantity.toString(),
        balanceBefore: result.movement.balanceBefore.toString(),
        balanceAfter: result.movement.balanceAfter.toString(),
      },
    });

    return result;
  }

  async createWasteRecord(
    branchId: string,
    ingredientId: string,
    actorUserId: string,
    dto: CreateWasteRecordDto,
  ) {
    const quantity = new Prisma.Decimal(dto.quantity);

    const result = await this.prisma.$transaction(async (tx) => {
      const ingredient = await this.ensureIngredientInBranchTx(tx, branchId, ingredientId);
      const balanceAfter = ingredient.currentStock.minus(quantity);

      if (balanceAfter.lessThan(0)) {
        throw new ConflictException(`Insufficient stock for waste on ingredient ${ingredient.name}`);
      }

      const wasteRecord = await tx.wasteRecord.create({
        data: {
          branchId,
          ingredientId: ingredient.id,
          quantity,
          reason: dto.reason.trim(),
          createdByUserId: actorUserId,
        },
      });

      const movement = await this.applyIngredientMovementTx(tx, {
        branchId,
        ingredientId: ingredient.id,
        movementType: StockMovementType.WASTE,
        quantity,
        referenceType: StockReferenceType.WASTE_RECORD,
        referenceId: wasteRecord.id,
        notes: dto.reason,
        createdByUserId: actorUserId,
      });

      return {
        wasteRecord,
        movement: movement.movement,
      };
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_WASTE_RECORD',
      entity: 'waste_record',
      metadata: {
        wasteRecordId: result.wasteRecord.id,
        ingredientId,
        branchId,
        quantity: quantity.toString(),
      },
    });

    return result;
  }

  async listIngredientWasteRecords(
    branchId: string,
    ingredientId: string,
    query: ListIngredientWasteRecordsDto,
  ) {
    await this.getIngredientById(branchId, ingredientId);

    return this.prisma.wasteRecord.findMany({
      where: {
        branchId,
        ingredientId,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit,
    });
  }

  async createRecipe(branchId: string, actorUserId: string, dto: CreateRecipeDto) {
    const target = await this.resolveRecipeTarget(branchId, {
      productId: dto.productId,
      productVariantId: dto.productVariantId,
    });

    await this.ensureRecipeTargetUnique(branchId, target.productId, target.productVariantId);

    const recipe = await this.prisma.recipe.create({
      data: {
        branchId,
        productId: target.productId,
        productVariantId: target.productVariantId,
        name: normalizeName(dto.name),
        isActive: dto.isActive ?? true,
      },
      include: {
        product: true,
        productVariant: {
          include: {
            product: true,
          },
        },
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_RECIPE',
      entity: 'recipe',
      metadata: {
        recipeId: recipe.id,
        branchId,
        productId: recipe.productId,
        productVariantId: recipe.productVariantId,
      },
    });

    return recipe;
  }

  async listRecipes(branchId: string, query: ListRecipesDto) {
    return this.prisma.recipe.findMany({
      where: {
        branchId,
        isActive: query.isActive,
        productId: query.productId,
        productVariantId: query.productVariantId,
      },
      include: {
        product: true,
        productVariant: {
          include: {
            product: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit,
    });
  }

  async getRecipeById(branchId: string, recipeId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: {
        id: recipeId,
        branchId,
      },
      include: {
        product: true,
        productVariant: {
          include: {
            product: true,
          },
        },
        items: {
          include: {
            ingredient: {
              include: {
                unit: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    return recipe;
  }

  async updateRecipe(branchId: string, recipeId: string, actorUserId: string, dto: UpdateRecipeDto) {
    const recipe = await this.getRecipeById(branchId, recipeId);

    let nextProductId = recipe.productId;
    let nextProductVariantId = recipe.productVariantId;

    if (dto.productId !== undefined || dto.productVariantId !== undefined) {
      nextProductId = dto.productId ?? null;
      nextProductVariantId = dto.productVariantId ?? null;
    }

    const target = await this.resolveRecipeTarget(branchId, {
      productId: nextProductId,
      productVariantId: nextProductVariantId,
    });

    if (target.productId !== recipe.productId || target.productVariantId !== recipe.productVariantId) {
      await this.ensureRecipeTargetUnique(branchId, target.productId, target.productVariantId, recipe.id);
    }

    const updateData: Prisma.RecipeUncheckedUpdateInput = {
      productId: target.productId,
      productVariantId: target.productVariantId,
    };

    if (dto.name !== undefined) {
      updateData.name = normalizeName(dto.name);
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    const updated = await this.prisma.recipe.update({
      where: {
        id: recipe.id,
      },
      data: updateData,
      include: {
        product: true,
        productVariant: {
          include: {
            product: true,
          },
        },
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_RECIPE',
      entity: 'recipe',
      metadata: {
        recipeId: recipe.id,
        branchId,
        changes: {
          name: updateData.name,
          isActive: updateData.isActive,
          productId: updated.productId,
          productVariantId: updated.productVariantId,
        },
      },
    });

    return updated;
  }

  async deleteRecipe(branchId: string, recipeId: string, actorUserId: string) {
    const recipe = await this.getRecipeById(branchId, recipeId);

    if (recipe.items.length > 0) {
      throw new ConflictException('Cannot delete recipe with recipe items. Remove items first or disable recipe');
    }

    await this.prisma.recipe.delete({
      where: {
        id: recipe.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_RECIPE',
      entity: 'recipe',
      metadata: {
        recipeId: recipe.id,
        branchId,
      },
    });

    return {
      message: 'Recipe deleted successfully',
    };
  }

  async addRecipeItem(branchId: string, recipeId: string, actorUserId: string, dto: CreateRecipeItemDto) {
    const recipe = await this.getRecipeById(branchId, recipeId);
    const ingredient = await this.ensureIngredientInBranch(branchId, dto.ingredientId);

    if (!ingredient.isActive) {
      throw new ConflictException('Inactive ingredient cannot be used in recipes');
    }

    const duplicate = await this.prisma.recipeItem.findFirst({
      where: {
        recipeId: recipe.id,
        ingredientId: ingredient.id,
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new ConflictException('Ingredient already exists in recipe');
    }

    const recipeItem = await this.prisma.recipeItem.create({
      data: {
        recipeId: recipe.id,
        ingredientId: ingredient.id,
        quantity: new Prisma.Decimal(dto.quantity),
      },
      include: {
        ingredient: {
          include: {
            unit: true,
          },
        },
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'ADD_RECIPE_ITEM',
      entity: 'recipe_item',
      metadata: {
        recipeId: recipe.id,
        recipeItemId: recipeItem.id,
        ingredientId: ingredient.id,
        branchId,
      },
    });

    return recipeItem;
  }

  async listRecipeItems(branchId: string, recipeId: string) {
    const recipe = await this.getRecipeById(branchId, recipeId);

    return this.prisma.recipeItem.findMany({
      where: {
        recipeId: recipe.id,
      },
      include: {
        ingredient: {
          include: {
            unit: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async updateRecipeItem(
    branchId: string,
    recipeId: string,
    itemId: string,
    actorUserId: string,
    dto: UpdateRecipeItemDto,
  ) {
    const recipe = await this.getRecipeById(branchId, recipeId);

    const recipeItem = await this.prisma.recipeItem.findFirst({
      where: {
        id: itemId,
        recipeId: recipe.id,
      },
      include: {
        ingredient: true,
      },
    });

    if (!recipeItem) {
      throw new NotFoundException('Recipe item not found');
    }

    const nextIngredientId = dto.ingredientId ?? recipeItem.ingredientId;
    const nextQuantity = dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : recipeItem.quantity;

    if (nextIngredientId !== recipeItem.ingredientId) {
      const ingredient = await this.ensureIngredientInBranch(branchId, nextIngredientId);
      if (!ingredient.isActive) {
        throw new ConflictException('Inactive ingredient cannot be used in recipes');
      }

      const duplicate = await this.prisma.recipeItem.findFirst({
        where: {
          recipeId: recipe.id,
          ingredientId: nextIngredientId,
          id: {
            not: recipeItem.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (duplicate) {
        throw new ConflictException('Ingredient already exists in recipe');
      }
    }

    const updated = await this.prisma.recipeItem.update({
      where: {
        id: recipeItem.id,
      },
      data: {
        ingredientId: nextIngredientId,
        quantity: nextQuantity,
      },
      include: {
        ingredient: {
          include: {
            unit: true,
          },
        },
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_RECIPE_ITEM',
      entity: 'recipe_item',
      metadata: {
        recipeId: recipe.id,
        recipeItemId: recipeItem.id,
        ingredientId: updated.ingredientId,
        branchId,
        quantity: updated.quantity.toString(),
      },
    });

    return updated;
  }

  async deleteRecipeItem(branchId: string, recipeId: string, itemId: string, actorUserId: string) {
    const recipe = await this.getRecipeById(branchId, recipeId);

    const recipeItem = await this.prisma.recipeItem.findFirst({
      where: {
        id: itemId,
        recipeId: recipe.id,
      },
      select: {
        id: true,
        ingredientId: true,
      },
    });

    if (!recipeItem) {
      throw new NotFoundException('Recipe item not found');
    }

    await this.prisma.recipeItem.delete({
      where: {
        id: recipeItem.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'DELETE_RECIPE_ITEM',
      entity: 'recipe_item',
      metadata: {
        recipeId: recipe.id,
        recipeItemId: recipeItem.id,
        ingredientId: recipeItem.ingredientId,
        branchId,
      },
    });

    return {
      message: 'Recipe item deleted successfully',
    };
  }

  async listIngredientStockMovements(
    branchId: string,
    ingredientId: string,
    query: ListIngredientStockMovementsDto,
  ) {
    await this.getIngredientById(branchId, ingredientId);

    return this.prisma.stockMovement.findMany({
      where: {
        branchId,
        ingredientId,
      },
      include: {
        ingredient: {
          include: {
            unit: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit,
    });
  }

  async listStockMovements(branchId: string, query: ListStockMovementsDto) {
    if (query.ingredientId) {
      await this.getIngredientById(branchId, query.ingredientId);
    }

    return this.prisma.stockMovement.findMany({
      where: {
        branchId,
        ingredientId: query.ingredientId,
        movementType: query.movementType,
        referenceType: query.referenceType,
      },
      include: {
        ingredient: {
          include: {
            unit: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit,
    });
  }

  async getInventorySummary(branchId: string, query: GetInventorySummaryDto) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        branchId,
        isActive: query.activeOnly ? true : undefined,
      },
      include: {
        unit: true,
      },
      orderBy: [{ name: 'asc' }],
      take: query.limit,
    });

    const ingredientIds = ingredients.map((ingredient) => ingredient.id);

    const latestMovementsRaw = ingredientIds.length
      ? await this.prisma.stockMovement.groupBy({
          by: ['ingredientId'],
          where: {
            branchId,
            ingredientId: {
              in: ingredientIds,
            },
          },
          _max: {
            createdAt: true,
          },
        })
      : [];

    const latestMovementByIngredientId = new Map(
      latestMovementsRaw.map((row) => [row.ingredientId, row._max.createdAt]),
    );

    const recipeCoverageRows = ingredientIds.length
      ? await this.prisma.recipeItem.groupBy({
          by: ['ingredientId'],
          where: {
            ingredientId: {
              in: ingredientIds,
            },
            recipe: {
              branchId,
              isActive: true,
            },
          },
          _count: {
            _all: true,
          },
        })
      : [];

    const recipeCoverageByIngredientId = new Map(
      recipeCoverageRows.map((row) => [row.ingredientId, row._count._all]),
    );

    const recentMovementCount = ingredientIds.length
      ? await this.prisma.stockMovement.count({
          where: {
            branchId,
            ingredientId: {
              in: ingredientIds,
            },
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        })
      : 0;

    const lowStockCount = ingredients.filter((ingredient) =>
      this.isLowStock(ingredient.currentStock, ingredient.lowStockThreshold),
    ).length;

    return {
      branchId,
      generatedAt: new Date().toISOString(),
      totalIngredients: ingredients.length,
      activeIngredients: ingredients.filter((ingredient) => ingredient.isActive).length,
      inactiveIngredients: ingredients.filter((ingredient) => !ingredient.isActive).length,
      lowStockCount,
      recentMovementCount24h: recentMovementCount,
      recipeCoverageCount: recipeCoverageRows.length,
      items: ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        sku: ingredient.sku,
        currentStock: ingredient.currentStock,
        lowStockThreshold: ingredient.lowStockThreshold,
        isLowStock: this.isLowStock(ingredient.currentStock, ingredient.lowStockThreshold),
        recipeUsageCount: recipeCoverageByIngredientId.get(ingredient.id) ?? 0,
        isActive: ingredient.isActive,
        unit: ingredient.unit,
        latestMovementAt: latestMovementByIngredientId.get(ingredient.id) ?? null,
      })),
    };
  }

  async getIngredientDetail(branchId: string, ingredientId: string) {
    const ingredient = await this.getIngredientById(branchId, ingredientId);

    const [recentMovements, recentWasteRecords, linkedRecipeItems] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: {
          branchId,
          ingredientId,
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.wasteRecord.findMany({
        where: {
          branchId,
          ingredientId,
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
      }),
      this.prisma.recipeItem.findMany({
        where: {
          ingredientId,
          recipe: {
            branchId,
          },
        },
        include: {
          recipe: {
            select: {
              id: true,
              name: true,
              isActive: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
              productVariant: {
                select: {
                  id: true,
                  name: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 30,
      }),
    ]);

    return {
      ingredient,
      isLowStock: this.isLowStock(ingredient.currentStock, ingredient.lowStockThreshold),
      recentMovements,
      recentWasteRecords,
      linkedRecipes: linkedRecipeItems.map((item) => ({
        id: item.recipe.id,
        name: item.recipe.name,
        isActive: item.recipe.isActive,
        quantityPerRecipe: item.quantity,
        product: item.recipe.product,
        productVariant: item.recipe.productVariant,
      })),
    };
  }

  async consumeOrderStockOnPaidTx(
    tx: Prisma.TransactionClient,
    input: {
      branchId: string;
      orderId: string;
      actorUserId: string;
    },
  ) {
    const existingConsumption = await tx.orderConsumption.findUnique({
      where: {
        orderId: input.orderId,
      },
      select: {
        id: true,
      },
    });

    if (existingConsumption) {
      return {
        skipped: true,
        reason: 'ALREADY_CONSUMED',
      };
    }

    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        branchId: input.branchId,
      },
      select: {
        id: true,
        branchId: true,
        orderNumber: true,
        status: true,
        items: {
          where: {
            status: OrderItemStatus.ACTIVE,
          },
          select: {
            id: true,
            productId: true,
            variantId: true,
            productNameSnapshot: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found for stock consumption');
    }

    if (order.status !== OrderStatus.PAID) {
      throw new ConflictException('Stock consumption is only allowed when order is PAID');
    }

    let orderConsumptionRecord: { id: string } | null = null;

    try {
      const created = await tx.orderConsumption.create({
        data: {
          branchId: input.branchId,
          orderId: order.id,
          consumedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      orderConsumptionRecord = created;
    } catch (error) {
      const duplicateConsumption =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

      if (duplicateConsumption) {
        return {
          skipped: true,
          reason: 'ALREADY_CONSUMED',
        };
      }

      throw error;
    }

    const catalogOrderItems = order.items.filter((item) => Boolean(item.productId));

    if (catalogOrderItems.length === 0) {
      await this.createOrderEventTx(tx, {
        orderId: order.id,
        actorUserId: input.actorUserId,
        eventType: ORDER_EVENT_TYPES.STOCK_CONSUMPTION_SKIPPED_NO_RECIPE,
        payloadJson: {
          reason: 'NO_CATALOG_ORDER_ITEMS',
          orderConsumptionId: orderConsumptionRecord.id,
        },
      });

      return {
        skipped: true,
        reason: 'NO_CATALOG_ORDER_ITEMS',
      };
    }

    const productIds = Array.from(
      new Set(catalogOrderItems.map((item) => item.productId).filter((value): value is string => Boolean(value))),
    );
    const variantIds = Array.from(
      new Set(catalogOrderItems.map((item) => item.variantId).filter((value): value is string => Boolean(value))),
    );

    const recipeOrFilters: Prisma.RecipeWhereInput[] = [];
    if (variantIds.length > 0) {
      recipeOrFilters.push({
        productVariantId: {
          in: variantIds,
        },
      });
    }

    if (productIds.length > 0) {
      recipeOrFilters.push({
        productId: {
          in: productIds,
        },
      });
    }

    const recipes = recipeOrFilters.length
      ? await tx.recipe.findMany({
          where: {
            branchId: input.branchId,
            isActive: true,
            OR: recipeOrFilters,
          },
          include: {
            items: {
              include: {
                ingredient: {
                  select: {
                    id: true,
                    name: true,
                    branchId: true,
                  },
                },
              },
            },
          },
        })
      : [];

    const recipeByVariantId = new Map(
      recipes
        .filter((recipe) => Boolean(recipe.productVariantId))
        .map((recipe) => [recipe.productVariantId as string, recipe]),
    );

    const recipeByProductId = new Map(
      recipes
        .filter((recipe) => Boolean(recipe.productId))
        .map((recipe) => [recipe.productId as string, recipe]),
    );

    const requiredByIngredient = new Map<string, Prisma.Decimal>();
    const consumptionSourceRows: Array<{
      orderItemId: string;
      recipeId: string;
      ingredientId: string;
      requiredQuantity: Prisma.Decimal;
    }> = [];
    const noRecipeItemIds: string[] = [];

    for (const item of catalogOrderItems) {
      const recipe =
        (item.variantId ? recipeByVariantId.get(item.variantId) : null) ??
        (item.productId ? recipeByProductId.get(item.productId) : null);

      if (!recipe || recipe.items.length === 0) {
        noRecipeItemIds.push(item.id);
        continue;
      }

      for (const recipeItem of recipe.items) {
        if (recipeItem.ingredient.branchId !== input.branchId) {
          throw new ConflictException('Cross-branch ingredient detected in recipe consumption');
        }

        const requiredQuantity = recipeItem.quantity.mul(item.quantity);
        const currentRequired = requiredByIngredient.get(recipeItem.ingredientId) ?? new Prisma.Decimal(0);
        requiredByIngredient.set(recipeItem.ingredientId, currentRequired.plus(requiredQuantity));

        consumptionSourceRows.push({
          orderItemId: item.id,
          recipeId: recipe.id,
          ingredientId: recipeItem.ingredientId,
          requiredQuantity,
        });
      }
    }

    if (requiredByIngredient.size === 0) {
      await this.createOrderEventTx(tx, {
        orderId: order.id,
        actorUserId: input.actorUserId,
        eventType: ORDER_EVENT_TYPES.STOCK_CONSUMPTION_SKIPPED_NO_RECIPE,
        payloadJson: {
          reason: 'NO_ACTIVE_RECIPE_MATCH',
          noRecipeItemIds,
          orderConsumptionId: orderConsumptionRecord.id,
        },
      });

      return {
        skipped: true,
        reason: 'NO_ACTIVE_RECIPE_MATCH',
      };
    }

    const ingredientIds = Array.from(requiredByIngredient.keys());
    const ingredients = await tx.ingredient.findMany({
      where: {
        branchId: input.branchId,
        id: {
          in: ingredientIds,
        },
      },
      select: {
        id: true,
        name: true,
        currentStock: true,
      },
    });

    if (ingredients.length !== ingredientIds.length) {
      throw new ConflictException('One or more ingredients were not found for recipe consumption');
    }

    const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    for (const [ingredientId, requiredQuantity] of requiredByIngredient.entries()) {
      const ingredient = ingredientById.get(ingredientId);
      if (!ingredient) {
        throw new NotFoundException('Ingredient not found for stock consumption');
      }

      const balanceAfter = ingredient.currentStock.minus(requiredQuantity);
      if (balanceAfter.lessThan(0)) {
        throw new ConflictException(
          `Insufficient stock for ingredient ${ingredient.name}. Required: ${requiredQuantity.toString()}, Current: ${ingredient.currentStock.toString()}`,
        );
      }
    }

    const movementRows: Array<{
      movementId: string;
      ingredientId: string;
      quantity: string;
      balanceBefore: string;
      balanceAfter: string;
    }> = [];

    for (const [ingredientId, requiredQuantity] of requiredByIngredient.entries()) {
      const ingredient = ingredientById.get(ingredientId);
      if (!ingredient) {
        throw new NotFoundException('Ingredient not found for stock consumption');
      }

      const balanceBefore = ingredient.currentStock;
      const balanceAfter = balanceBefore.minus(requiredQuantity);

      await tx.ingredient.update({
        where: {
          id: ingredient.id,
        },
        data: {
          currentStock: balanceAfter,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          branchId: input.branchId,
          ingredientId: ingredient.id,
          movementType: StockMovementType.OUT,
          quantity: requiredQuantity,
          balanceBefore,
          balanceAfter,
          referenceType: StockReferenceType.RECIPE_CONSUMPTION,
          referenceId: order.id,
          notes: `Order ${order.orderNumber} recipe consumption`,
          createdByUserId: input.actorUserId,
        },
      });

      ingredient.currentStock = balanceAfter;

      movementRows.push({
        movementId: movement.id,
        ingredientId: ingredient.id,
        quantity: requiredQuantity.toString(),
        balanceBefore: balanceBefore.toString(),
        balanceAfter: balanceAfter.toString(),
      });
    }

    await this.createOrderEventTx(tx, {
      orderId: order.id,
      actorUserId: input.actorUserId,
      eventType: ORDER_EVENT_TYPES.ORDER_STOCK_CONSUMED,
      payloadJson: {
        orderConsumptionId: orderConsumptionRecord.id,
        movementCount: movementRows.length,
        consumedIngredientCount: requiredByIngredient.size,
        noRecipeItemIds,
        movements: movementRows,
        sources: consumptionSourceRows.map((row) => ({
          orderItemId: row.orderItemId,
          recipeId: row.recipeId,
          ingredientId: row.ingredientId,
          requiredQuantity: row.requiredQuantity.toString(),
        })),
      },
    });

    await this.auditService.logAction({
      userId: input.actorUserId,
      action: 'CONSUME_ORDER_STOCK',
      entity: 'order_consumption',
      metadata: {
        orderId: order.id,
        orderConsumptionId: orderConsumptionRecord.id,
        branchId: input.branchId,
        movementCount: movementRows.length,
      },
    });

    return {
      skipped: false,
      movementCount: movementRows.length,
    };
  }

  private async resolveRecipeTarget(
    branchId: string,
    input: {
      productId?: string | null;
      productVariantId?: string | null;
    },
  ) {
    assertRecipeTargetExclusive(input.productId, input.productVariantId);

    if (input.productId) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: input.productId,
          branchId,
        },
        select: {
          id: true,
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found in current branch');
      }

      return {
        productId: product.id,
        productVariantId: null,
      };
    }

    if (input.productVariantId) {
      const productVariant = await this.prisma.productVariant.findFirst({
        where: {
          id: input.productVariantId,
          product: {
            branchId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!productVariant) {
        throw new NotFoundException('Product variant not found in current branch');
      }

      return {
        productId: null,
        productVariantId: productVariant.id,
      };
    }

    throw new BadRequestException('Recipe target is invalid');
  }

  private async ensureRecipeTargetUnique(
    branchId: string,
    productId: string | null,
    productVariantId: string | null,
    ignoreRecipeId?: string,
  ) {
    const duplicate = await this.prisma.recipe.findFirst({
      where: {
        branchId,
        id: ignoreRecipeId ? { not: ignoreRecipeId } : undefined,
        ...(productId
          ? {
              productId,
            }
          : {
              productVariantId: productVariantId ?? undefined,
            }),
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new ConflictException('Recipe already exists for the selected target');
    }
  }

  private async ensureUnitExists(unitId: string) {
    const unit = await this.prisma.unitOfMeasure.findUnique({
      where: {
        id: unitId,
      },
      select: {
        id: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    return unit;
  }

  private isLowStock(currentStock: Prisma.Decimal | string | number, threshold: Prisma.Decimal | string | number) {
    const stock = new Prisma.Decimal(currentStock);
    const minThreshold = new Prisma.Decimal(threshold);
    if (minThreshold.lessThanOrEqualTo(0)) {
      return false;
    }
    return stock.lessThanOrEqualTo(minThreshold);
  }

  private async ensureIngredientInBranch(branchId: string, ingredientId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: {
        id: ingredientId,
        branchId,
      },
      include: {
        unit: true,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found in current branch');
    }

    return ingredient;
  }

  private async ensureIngredientInBranchTx(
    tx: Prisma.TransactionClient,
    branchId: string,
    ingredientId: string,
  ) {
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: ingredientId,
        branchId,
      },
      select: {
        id: true,
        name: true,
        currentStock: true,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found in current branch');
    }

    return ingredient;
  }

  private async applyIngredientMovementTx(
    tx: Prisma.TransactionClient,
    input: {
      branchId: string;
      ingredientId: string;
      movementType: StockMovementType;
      quantity: Prisma.Decimal;
      referenceType: StockReferenceType;
      referenceId?: string | null;
      notes?: string | null;
      createdByUserId: string;
    },
  ) {
    if (input.quantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Movement quantity must be greater than zero');
    }

    const ingredient = await this.ensureIngredientInBranchTx(tx, input.branchId, input.ingredientId);

    const movementDecreasesStock =
      input.movementType === StockMovementType.OUT ||
      input.movementType === StockMovementType.ADJUSTMENT_MINUS ||
      input.movementType === StockMovementType.WASTE;

    const balanceAfter = movementDecreasesStock
      ? ingredient.currentStock.minus(input.quantity)
      : ingredient.currentStock.plus(input.quantity);

    if (balanceAfter.lessThan(0)) {
      throw new ConflictException(
        `Insufficient stock for ingredient ${ingredient.name}. Current: ${ingredient.currentStock.toString()}, Requested: ${input.quantity.toString()}`,
      );
    }

    await tx.ingredient.update({
      where: {
        id: ingredient.id,
      },
      data: {
        currentStock: balanceAfter,
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        branchId: input.branchId,
        ingredientId: ingredient.id,
        movementType: input.movementType,
        quantity: input.quantity,
        balanceBefore: ingredient.currentStock,
        balanceAfter,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        notes: input.notes,
        createdByUserId: input.createdByUserId,
      },
    });

    return {
      movement,
      ingredientId: ingredient.id,
      balanceBefore: ingredient.currentStock,
      balanceAfter,
    };
  }

  private async createOrderEventTx(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      eventType: string;
      actorUserId: string;
      payloadJson?: Prisma.InputJsonValue;
    },
  ) {
    await tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        payloadJson: input.payloadJson,
      },
    });
  }
}
