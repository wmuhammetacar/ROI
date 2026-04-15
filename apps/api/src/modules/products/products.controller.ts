import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateBranchPriceOverrideDto } from '../pricing/dto/create-branch-price-override.dto';
import { UpdateBranchPriceOverrideDto } from '../pricing/dto/update-branch-price-override.dto';
import { CreateProductModifierGroupLinkDto } from './dto/create-product-modifier-group-link.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductActiveStateDto } from './dto/update-product-active-state.dto';
import { UpdateProductAvailabilityDto } from './dto/update-product-availability.dto';
import { UpdateProductModifierGroupLinkDto } from './dto/update-product-modifier-group-link.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly pricingService: PricingService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post()
  @Roles(APP_ROLES.ADMIN)
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.productsService.create(user.branchId, user.sub, dto);
  }

  @Get()
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findAll(@Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.productsService.findAll(branchId);
  }

  @Get(':id')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findById(@Param('id') id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.productsService.findById(branchId, id);
  }

  @Patch(':id')
  @Roles(APP_ROLES.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthUser) {
    return this.productsService.update(user.branchId, id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(APP_ROLES.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.remove(user.branchId, id, user.sub);
  }

  @Patch(':id/availability')
  @Roles(APP_ROLES.ADMIN)
  updateAvailability(
    @Param('id') id: string,
    @Body() dto: UpdateProductAvailabilityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.updateAvailability(user.branchId, id, user.sub, dto);
  }

  @Patch(':id/active-state')
  @Roles(APP_ROLES.ADMIN)
  updateActiveState(
    @Param('id') id: string,
    @Body() dto: UpdateProductActiveStateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.updateActiveState(user.branchId, id, user.sub, dto);
  }

  @Post(':id/variants')
  @Roles(APP_ROLES.ADMIN)
  createVariant(
    @Param('id') id: string,
    @Body() dto: CreateProductVariantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.createVariant(user.branchId, id, user.sub, dto);
  }

  @Get(':id/variants')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findVariants(@Param('id') id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.productsService.findVariants(branchId, id);
  }

  @Patch(':id/variants/:variantId')
  @Roles(APP_ROLES.ADMIN)
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.updateVariant(user.branchId, id, variantId, user.sub, dto);
  }

  @Delete(':id/variants/:variantId')
  @Roles(APP_ROLES.ADMIN)
  removeVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.removeVariant(user.branchId, id, variantId, user.sub);
  }

  @Post(':id/modifier-groups')
  @Roles(APP_ROLES.ADMIN)
  createModifierGroupLink(
    @Param('id') id: string,
    @Body() dto: CreateProductModifierGroupLinkDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.createModifierGroupLink(user.branchId, id, user.sub, dto);
  }

  @Get(':id/modifier-groups')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findModifierGroupLinks(
    @Param('id') id: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.productsService.findModifierGroupLinks(branchId, id);
  }

  @Patch(':id/modifier-groups/:linkId')
  @Roles(APP_ROLES.ADMIN)
  updateModifierGroupLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateProductModifierGroupLinkDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.updateModifierGroupLink(user.branchId, id, linkId, user.sub, dto);
  }

  @Delete(':id/modifier-groups/:linkId')
  @Roles(APP_ROLES.ADMIN)
  removeModifierGroupLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.removeModifierGroupLink(user.branchId, id, linkId, user.sub);
  }

  @Post(':id/prices')
  @Roles(APP_ROLES.ADMIN)
  createPriceOverride(
    @Param('id') id: string,
    @Body() dto: CreateBranchPriceOverrideDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.createOverride(user.branchId, id, user.sub, dto);
  }

  @Get(':id/prices')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findPriceOverrides(
    @Param('id') id: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.pricingService.listOverrides(branchId, id);
  }

  @Patch(':id/prices/:priceId')
  @Roles(APP_ROLES.ADMIN)
  updatePriceOverride(
    @Param('id') id: string,
    @Param('priceId') priceId: string,
    @Body() dto: UpdateBranchPriceOverrideDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.updateOverride(user.branchId, id, priceId, user.sub, dto);
  }

  @Delete(':id/prices/:priceId')
  @Roles(APP_ROLES.ADMIN)
  removePriceOverride(
    @Param('id') id: string,
    @Param('priceId') priceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.deleteOverride(user.branchId, id, priceId, user.sub);
  }
}
