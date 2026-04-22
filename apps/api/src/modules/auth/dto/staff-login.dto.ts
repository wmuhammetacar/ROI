import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username!: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  @Matches(/^\d+$/)
  pin?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}
