import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(pbkdf2);
export async function hashPassword(password) {
  const salt = randomBytes(24).toString("hex");
  return `pbkdf2$600000$${salt}$${(await derive(password, salt, 600000, 32, "sha256")).toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 256 || !encoded)
    return false;
  const [algorithm, iterations, salt, hash] = encoded.split("$");
  if (
    algorithm !== "pbkdf2" ||
    iterations !== "600000" ||
    !/^[a-f0-9]{48}$/.test(salt) ||
    !/^[a-f0-9]{64}$/.test(hash)
  )
    return false;
  const actual = await derive(password, salt, Number(iterations), 32, "sha256");
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
