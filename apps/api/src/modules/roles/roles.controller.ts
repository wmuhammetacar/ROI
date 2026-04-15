import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Post()
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthUser) {
    return this.rolesService.createRole(dto, user.sub);
  }

  @Post('permissions')
  createPermission(@Body() dto: CreatePermissionDto, @CurrentUser() user: AuthUser) {
    return this.rolesService.createPermission(dto, user.sub);
  }

  @Post('assign-user')
  assignRoleToUser(@Body() dto: AssignRoleDto, @CurrentUser() user: AuthUser) {
    return this.rolesService.assignRoleToUser(dto, user.sub);
  }

  @Post('assign-permission')
  assignPermissionToRole(@Body() dto: AssignPermissionDto, @CurrentUser() user: AuthUser) {
    return this.rolesService.assignPermissionToRole(dto, user.sub);
  }
}
