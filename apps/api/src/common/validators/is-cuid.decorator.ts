import { registerDecorator, type ValidationOptions, type ValidationArguments } from 'class-validator';

const CUID_PATTERN = /^c[a-z0-9]{24}$/;

export function IsCuid(validationOptions?: ValidationOptions) {
  return (object: Object, propertyName: string | symbol) => {
    const resolvedPropertyName =
      typeof propertyName === 'symbol' ? propertyName.toString() : propertyName;

    registerDecorator({
      name: 'isCuid',
      target: object.constructor,
      propertyName: resolvedPropertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && CUID_PATTERN.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid CUID`;
        },
      },
    });
  };
}
