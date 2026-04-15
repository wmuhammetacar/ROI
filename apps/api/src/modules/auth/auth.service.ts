import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { APP_ROLES } from '../../common/constants/roles';
import { passwordHasher } from '../../common/utils/password-hasher';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface RequestContextInfo {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto, context: RequestContextInfo) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    const createUserDto: CreateUserDto = {
      name: dto.name,
      email: dto.email,
      password: dto.password,
      branchId: dto.branchId,
      roleNames: [APP_ROLES.WAITER],
    };

    const user = await this.usersService.createUser(createUserDto);

    await this.auditService.logAction({
      userId: user.id,
      action: 'AUTH_REGISTER',
      entity: 'auth',
      metadata: {
        email: user.email,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return user;
  }

  async login(dto: LoginDto, context: RequestContextInfo) {
    const user = await this.usersService.findByEmailForAuth(dto.email);

    if (!user) {
      await this.auditService.logAction({
        action: 'AUTH_LOGIN_FAILED',
        entity: 'auth',
        metadata: {
          email: dto.email.toLowerCase(),
          reason: 'email_not_found',
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await passwordHasher.compare(dto.password, user.password);
    if (!isPasswordValid) {
      await this.auditService.logAction({
        userId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        entity: 'auth',
        metadata: {
          email: dto.email.toLowerCase(),
          reason: 'invalid_password',
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = this.usersService.toAuthPayload(user);
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '1h');

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn,
    });

    await this.auditService.logAction({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entity: 'auth',
      metadata: {
        branchId: user.branchId,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: this.usersService.toPublicUser(user),
    };
  }
}
