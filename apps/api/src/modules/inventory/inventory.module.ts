import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { IngredientsController } from './ingredients.controller';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { RecipesController } from './recipes.controller';
import { StockMovementsController } from './stock-movements.controller';
import { UnitsController } from './units.controller';

@Module({
  imports: [AuditModule, BranchesModule],
  controllers: [
    UnitsController,
    IngredientsController,
    RecipesController,
    StockMovementsController,
    InventoryController,
  ],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
