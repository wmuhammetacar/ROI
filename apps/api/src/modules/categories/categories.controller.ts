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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post()
  @Roles(APP_ROLES.ADMIN)
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser) {
    return this.categoriesService.create(user.branchId, user.sub, dto);
  }

  @Get()
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findAll(@Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.categoriesService.findAll(branchId);
  }

  @Get(':id')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findById(@Param('id', ParseCuidPipe) id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.categoriesService.findById(branchId, id);
  }

  @Patch(':id')
  @Roles(APP_ROLES.ADMIN)
  update(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: AuthUser) {
    return this.categoriesService.update(user.branchId, id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(APP_ROLES.ADMIN)
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.categoriesService.remove(user.branchId, id, user.sub);
  }
}
