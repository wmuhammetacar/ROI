import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SetUserActiveStateDto } from './dto/set-user-active-state.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.findPublicById(user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(APP_ROLES.ADMIN)
  listUsers() {
    return this.usersService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(APP_ROLES.ADMIN)
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.createUser(dto, user.sub);
  }

  @Get('admin-only')
  @UseGuards(RolesGuard)
  @Roles(APP_ROLES.ADMIN)
  adminOnlyDemoRoute() {
    return {
      message: 'Admin route access granted',
    };
  }

  @Get('staff')
  @UseGuards(RolesGuard)
  @Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
  async listStaff(@Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.usersService.findStaff(branchId);
  }

  @Post('staff')
  @UseGuards(RolesGuard)
  @Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
  createStaff(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.createUser(dto, user.sub);
  }

  @Patch('staff/:id/active')
  @UseGuards(RolesGuard)
  @Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
  setStaffActive(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: SetUserActiveStateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.setActiveState(id, dto.isActive, user.sub);
  }
}
