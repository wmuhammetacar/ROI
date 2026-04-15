import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
