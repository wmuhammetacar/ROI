import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchNetworkSettingsDto } from './dto/update-branch-network-settings.dto';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthUser) {
    return this.branchesService.create(dto, user.sub);
  }

  @Get(':id')
  async findById(@Param('id', ParseCuidPipe) id: string) {
    const branch = await this.branchesService.findById(id);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  @Patch(':id/network-settings')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
  updateNetworkSettings(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateBranchNetworkSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchesService.updateNetworkSettings(id, dto, user.sub);
  }
}
