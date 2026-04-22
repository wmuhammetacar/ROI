import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  @Matches(/^\d+$/)
  pin?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  roleNames?: string[];
}
