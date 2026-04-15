import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CatalogService } from './catalog.service';
import { GetPosProductsDto } from './dto/get-pos-products.dto';

@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get('pos-products')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async getPosProducts(@CurrentUser() user: AuthUser, @Query() query: GetPosProductsDto) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.catalogService.getPosProducts(branchId, query);
  }
}
