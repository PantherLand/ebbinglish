"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";

export type UpdateStudyConfigState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const updateStudyConfigSchema = z.object({
  wordId: z.string().min(1),
  isPriority: z.boolean(),
  manualCategory: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function updateStudyConfigAction(
  _prevState: UpdateStudyConfigState,
  formData: FormData,
): Promise<UpdateStudyConfigState> {
  const parsed = updateStudyConfigSchema.safeParse({
    wordId: formData.get("wordId"),
    isPriority: formData.get("isPriority") === "on",
    manualCategory: formData.get("manualCategory") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: "Invalid config input" };
  }

  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return { status: "error", message: "Please sign in first" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return { status: "error", message: "User not found" };
  }

  const { wordId, isPriority, manualCategory } = parsed.data;

  const word = await prisma.word.findFirst({
    where: {
      id: wordId,
      userId: user.id,
    },
    select: { id: true },
  });

  if (!word) {
    return { status: "error", message: "Word not found" };
  }

  await prisma.word.update({
    where: { id: word.id },
    data: {
      isPriority,
      manualCategory: manualCategory || null,
    },
  });

  revalidatePath("/app/library");
  revalidatePath(`/app/library/${word.id}`);
  revalidatePath("/app/today");

  return { status: "success", message: "Study config saved" };
}
