import { IsBoolean } from 'class-validator';

export class UpdateIngredientActiveStateDto {
  @IsBoolean()
  isActive!: boolean;
}
