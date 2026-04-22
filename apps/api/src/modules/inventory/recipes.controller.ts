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
import { CreateRecipeItemDto } from './dto/create-recipe-item.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { ListRecipesDto } from './dto/list-recipes.dto';
import { UpdateRecipeItemDto } from './dto/update-recipe-item.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { InventoryService } from './inventory.service';

@Controller('recipes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER)
export class RecipesController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post()
  create(@Body() dto: CreateRecipeDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createRecipe(user.branchId, user.sub, dto);
  }

  @Get()
  async findAll(@Query() query: ListRecipesDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.listRecipes(branchId, query);
  }

  @Get(':id')
  async findById(@Param('id', ParseCuidPipe) id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.getRecipeById(branchId, id);
  }

  @Patch(':id')
  update(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateRecipeDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.updateRecipe(user.branchId, id, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.deleteRecipe(user.branchId, id, user.sub);
  }

  @Post(':id/items')
  addItem(@Param('id', ParseCuidPipe) id: string, @Body() dto: CreateRecipeItemDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.addRecipeItem(user.branchId, id, user.sub, dto);
  }

  @Get(':id/items')
  async listItems(@Param('id', ParseCuidPipe) id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.listRecipeItems(branchId, id);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id', ParseCuidPipe) id: string,
    @Param('itemId', ParseCuidPipe) itemId: string,
    @Body() dto: UpdateRecipeItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.updateRecipeItem(user.branchId, id, itemId, user.sub, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id', ParseCuidPipe) id: string, @Param('itemId', ParseCuidPipe) itemId: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.deleteRecipeItem(user.branchId, id, itemId, user.sub);
  }
}
