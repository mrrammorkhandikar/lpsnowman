import { z } from "zod";

export const surepassResponseSchema = z.object({
  success: z.boolean(),
  status_code: z.number().optional(),
  data: z.unknown().optional(),
  message: z.string().nullable().optional(),
  message_code: z.string().optional(),
});

export type SurepassResponse<T = unknown> = z.infer<typeof surepassResponseSchema> & {
  data?: T;
};

export function parseSurepassResponse<T>(payload: unknown): SurepassResponse<T> {
  return surepassResponseSchema.parse(payload) as SurepassResponse<T>;
}
