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
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CreateModifierGroupDto } from './dto/create-modifier-group.dto';
import { CreateModifierOptionDto } from './dto/create-modifier-option.dto';
import { UpdateModifierGroupDto } from './dto/update-modifier-group.dto';
import { UpdateModifierOptionDto } from './dto/update-modifier-option.dto';
import { ModifiersService } from './modifiers.service';

@Controller('modifier-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModifiersController {
  constructor(
    private readonly modifiersService: ModifiersService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post()
  @Roles(APP_ROLES.ADMIN)
  createGroup(@Body() dto: CreateModifierGroupDto, @CurrentUser() user: AuthUser) {
    return this.modifiersService.createGroup(user.branchId, user.sub, dto);
  }

  @Get()
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findAllGroups(@Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.modifiersService.findAllGroups(branchId);
  }

  @Get(':id')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findGroupById(@Param('id', ParseCuidPipe) id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.modifiersService.findGroupById(branchId, id);
  }

  @Patch(':id')
  @Roles(APP_ROLES.ADMIN)
  updateGroup(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateModifierGroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.modifiersService.updateGroup(user.branchId, id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(APP_ROLES.ADMIN)
  removeGroup(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.modifiersService.removeGroup(user.branchId, id, user.sub);
  }

  @Post(':id/options')
  @Roles(APP_ROLES.ADMIN)
  createOption(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: CreateModifierOptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.modifiersService.createOption(user.branchId, id, user.sub, dto);
  }

  @Get(':id/options')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async findOptions(@Param('id', ParseCuidPipe) id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.modifiersService.findOptions(branchId, id);
  }

  @Patch(':id/options/:optionId')
  @Roles(APP_ROLES.ADMIN)
  updateOption(
    @Param('id', ParseCuidPipe) id: string,
    @Param('optionId', ParseCuidPipe) optionId: string,
    @Body() dto: UpdateModifierOptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.modifiersService.updateOption(user.branchId, id, optionId, user.sub, dto);
  }

  @Delete(':id/options/:optionId')
  @Roles(APP_ROLES.ADMIN)
  removeOption(
    @Param('id', ParseCuidPipe) id: string,
    @Param('optionId', ParseCuidPipe) optionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.modifiersService.removeOption(user.branchId, id, optionId, user.sub);
  }
}
