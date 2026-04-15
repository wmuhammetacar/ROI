import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { resolve } from 'path';
import { envValidationSchema } from './config/env.validation';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ErrorTrackerService } from './common/services/error-tracker.service';
import { PrismaModule } from './database/prisma.module';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AuditModule } from './modules/audit/audit.module';
import { FloorsModule } from './modules/floors/floors.module';
import { TablesModule } from './modules/tables/tables.module';
import { TableSessionsModule } from './modules/table-sessions/table-sessions.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ModifiersModule } from './modules/modifiers/modifiers.module';
import { ProductsModule } from './modules/products/products.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { StationsModule } from './modules/stations/stations.module';
import { ProductionModule } from './modules/production/production.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ReportsModule } from './modules/reports/reports.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { PublicOrderingModule } from './modules/public-ordering/public-ordering.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('RATE_LIMIT_TTL_SECONDS', 60) * 1000,
            limit: configService.get<number>('RATE_LIMIT_MAX', 200),
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    BranchesModule,
    AuditModule,
    FloorsModule,
    TablesModule,
    TableSessionsModule,
    OrdersModule,
    CategoriesModule,
    ModifiersModule,
    ProductsModule,
    CatalogModule,
    StationsModule,
    ProductionModule,
    PaymentsModule,
    InventoryModule,
    ReportsModule,
    IntegrationsModule,
    PublicOrderingModule,
    RealtimeModule,
  ],
  providers: [
    ErrorTrackerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
