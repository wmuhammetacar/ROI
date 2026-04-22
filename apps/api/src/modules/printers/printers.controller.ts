import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { ListPrintersDto } from './dto/list-printers.dto';
import { PreviewPrinterRouteDto } from './dto/preview-printer-route.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { PrintersService } from './printers.service';

@Controller('printers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
export class PrintersController {
  constructor(
    private readonly printersService: PrintersService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get()
  async list(@Query() query: ListPrintersDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.printersService.list(branchId, query);
  }

  @Post()
  create(@Body() dto: CreatePrinterDto, @CurrentUser() user: AuthUser) {
    return this.printersService.create(user.branchId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdatePrinterDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.printersService.update(user.branchId, id, user.sub, dto);
  }

  @Post(':id/test')
  test(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.printersService.testPrint(user.branchId, id);
  }

  @Get('routing/preview')
  preview(@Query() query: PreviewPrinterRouteDto, @CurrentUser() user: AuthUser) {
    return this.printersService.previewRoute(user.branchId, query);
  }
}
