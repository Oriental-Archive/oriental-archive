import * as argon2 from "argon2";

// OWASP-recommended baseline for Argon2id (2024 cheat sheet: m=19MiB min for id;
// we use a higher memory cost since this only runs on librarian-scale traffic).
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(data: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return argon2.verify(data.hash, data.password);
}
