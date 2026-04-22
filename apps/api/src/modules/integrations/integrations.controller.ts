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
import { Throttle } from '@nestjs/throttler';
import { APP_ROLES } from '../../common/constants/roles';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { throttlePolicies } from '../../common/throttle/throttle-policies';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CreateBranchIntegrationConfigDto } from './dto/create-branch-integration-config.dto';
import { CreateMenuMappingDto } from './dto/create-menu-mapping.dto';
import { ListBranchIntegrationConfigsDto } from './dto/list-branch-integration-configs.dto';
import { ListExternalOrdersDto } from './dto/list-external-orders.dto';
import { ListIntegrationProvidersDto } from './dto/list-integration-providers.dto';
import { ListMenuMappingsDto } from './dto/list-menu-mappings.dto';
import { ListSyncAttemptsDto } from './dto/list-sync-attempts.dto';
import { TestIngestOrderDto } from './dto/test-ingest-order.dto';
import { UpdateBranchIntegrationConfigDto } from './dto/update-branch-integration-config.dto';
import { UpdateBranchIntegrationConfigStatusDto } from './dto/update-branch-integration-config-status.dto';
import { UpdateMenuMappingDto } from './dto/update-menu-mapping.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get('providers')
  listProviders(@Query() query: ListIntegrationProvidersDto) {
    return this.integrationsService.listProviders(query);
  }

  @Get('providers/:id')
  getProviderById(@Param('id', ParseCuidPipe) id: string) {
    return this.integrationsService.getProviderById(id);
  }

  @Get('configs')
  async listConfigs(@Query() query: ListBranchIntegrationConfigsDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.integrationsService.listConfigs(branchId, query);
  }

  @Get('configs/:id')
  async getConfigById(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.integrationsService.getConfigById(branchId, id);
  }

  @Post('configs')
  createConfig(@Body() dto: CreateBranchIntegrationConfigDto, @CurrentUser() user: AuthUser) {
    return this.integrationsService.createConfig(user, dto);
  }

  @Patch('configs/:id')
  updateConfig(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateBranchIntegrationConfigDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrationsService.updateConfig(user, id, dto);
  }

  @Patch('configs/:id/status')
  updateConfigStatus(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateBranchIntegrationConfigStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrationsService.updateConfigStatus(user, id, dto.status);
  }

  @Get('menu-mappings')
  async listMenuMappings(@Query() query: ListMenuMappingsDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.integrationsService.listMenuMappings(branchId, query);
  }

  @Post('menu-mappings')
  createMenuMapping(@Body() dto: CreateMenuMappingDto, @CurrentUser() user: AuthUser) {
    return this.integrationsService.createMenuMapping(user, dto);
  }

  @Patch('menu-mappings/:id')
  updateMenuMapping(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateMenuMappingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.integrationsService.updateMenuMapping(user, id, dto);
  }

  @Delete('menu-mappings/:id')
  deleteMenuMapping(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.integrationsService.deleteMenuMapping(user, id);
  }

  @Get('external-orders')
  async listExternalOrders(@Query() query: ListExternalOrdersDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.integrationsService.listExternalOrders(branchId, query);
  }

  @Get('external-orders/:id')
  async getExternalOrderById(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.integrationsService.getExternalOrderById(branchId, id);
  }

  @Get('sync-attempts')
  async listSyncAttempts(@Query() query: ListSyncAttemptsDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.integrationsService.listSyncAttempts(branchId, query);
  }

  @Post('providers/:providerId/test-ingest-order')
  @Throttle(throttlePolicies.integrationTest)
  async testIngestOrder(
    @Param('providerId', ParseCuidPipe) providerId: string,
    @Body() dto: TestIngestOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, dto.branchId);
    return this.integrationsService.testIngestOrder(user, providerId, {
      ...dto,
      branchId,
    });
  }
}
