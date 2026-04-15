import { Type } from 'class-transformer';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateFloorDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}
