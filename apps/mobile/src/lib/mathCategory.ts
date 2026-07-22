import type { Category } from "@/types/domain";

export function findMathCategoryId(categories: Category[]): string | null {
  return categories.find((c) => c.slug === "math")?.id ?? null;
}
