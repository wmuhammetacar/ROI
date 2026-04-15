type PasswordHasher = {
  hash(data: string, saltOrRounds: string | number): Promise<string>;
  compare(data: string, encrypted: string): Promise<boolean>;
};

let resolvedHasher: PasswordHasher;

try {
  // Prefer native bcrypt when available.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  resolvedHasher = require('bcrypt') as PasswordHasher;
} catch {
  // Fallback for environments where native bindings are unavailable.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  resolvedHasher = require('bcryptjs') as PasswordHasher;
}

export const passwordHasher: PasswordHasher = resolvedHasher;

