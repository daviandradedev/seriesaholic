import { Prisma } from "@prisma/client";

export function isSchemaFieldError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientValidationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2022";
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("unknown argument") ||
      msg.includes("unknown field") ||
      msg.includes("does not exist") ||
      msg.includes("column")
    );
  }
  return false;
}

export async function withSchemaFallback<T>(
  fn: () => Promise<T>,
  fallback: () => Promise<T> | T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isSchemaFieldError(err)) return await fallback();
    throw err;
  }
}
