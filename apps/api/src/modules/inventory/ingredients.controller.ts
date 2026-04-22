import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { ListIngredientStockMovementsDto } from './dto/list-ingredient-stock-movements.dto';
import { ListIngredientWasteRecordsDto } from './dto/list-ingredient-waste-records.dto';
import { ListIngredientsDto } from './dto/list-ingredients.dto';
import { UpdateIngredientActiveStateDto } from './dto/update-ingredient-active-state.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { InventoryService } from './inventory.service';

@Controller('ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
export class IngredientsController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post()
  create(@Body() dto: CreateIngredientDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createIngredient(user.branchId, user.sub, dto);
  }

  @Get()
  async findAll(@Query() query: ListIngredientsDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.listIngredients(branchId, query);
  }

  @Get(':id')
  async findById(@Param('id', ParseCuidPipe) id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.getIngredientById(branchId, id);
  }

  @Get(':id/detail')
  async getDetail(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.getIngredientDetail(branchId, id);
  }

  @Patch(':id')
  update(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateIngredientDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.updateIngredient(user.branchId, id, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.deleteIngredient(user.branchId, id, user.sub);
  }

  @Patch(':id/active-state')
  updateActiveState(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateIngredientActiveStateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.updateIngredientActiveState(user.branchId, id, user.sub, dto);
  }

  @Post(':id/adjust-stock')
  adjustStock(@Param('id', ParseCuidPipe) id: string, @Body() dto: AdjustStockDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.adjustIngredientStock(user.branchId, id, user.sub, dto);
  }

  @Post(':id/waste')
  createWaste(@Param('id', ParseCuidPipe) id: string, @Body() dto: CreateWasteRecordDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createWasteRecord(user.branchId, id, user.sub, dto);
  }

  @Get(':id/waste-records')
  async listWasteRecords(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: ListIngredientWasteRecordsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.listIngredientWasteRecords(branchId, id, query);
  }

  @Get(':id/stock-movements')
  async listStockMovements(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: ListIngredientStockMovementsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.listIngredientStockMovements(branchId, id, query);
  }
}
