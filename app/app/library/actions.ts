"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";

export type CreateWordState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const createWordSchema = z.object({
  text: z.string().trim().min(1, "Word is required").max(100, "Word is too long"),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Language code is required")
    .max(10, "Language code is too long"),
  note: z
    .string()
    .trim()
    .max(500, "Note is too long")
    .optional()
    .or(z.literal("")),
});

const listWordActionSchema = z.object({
  wordId: z.string().trim().min(1, "Word id is required"),
});

const togglePrioritySchema = z.object({
  wordId: z.string().trim().min(1, "Word id is required"),
  nextPriority: z.enum(["true", "false"]),
});

export async function createWordAction(
  _prevState: CreateWordState,
  formData: FormData,
): Promise<CreateWordState> {
  const parsed = createWordSchema.safeParse({
    text: formData.get("text"),
    language: formData.get("language") ?? "en",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return { status: "error", message };
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

  const { text, language, note } = parsed.data;
  const finalNote = note || null;

  try {
    await prisma.word.create({
      data: {
        userId: user.id,
        text,
        language,
        note: finalNote,
        reviewState: {
          create: {
            userId: user.id,
          },
        },
      },
    });

    revalidatePath("/app/library");
    return { status: "success", message: `Added "${text}"` };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        status: "error",
        message: "This word already exists in your library",
      };
    }

    return { status: "error", message: "Failed to add word" };
  }
}

export async function togglePriorityFromListAction(formData: FormData): Promise<void> {
  const parsed = togglePrioritySchema.safeParse({
    wordId: formData.get("wordId"),
    nextPriority: formData.get("nextPriority"),
  });

  if (!parsed.success) {
    console.error("[togglePriorityFromListAction] Invalid input:", parsed.error.flatten());
    return;
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    console.error("[togglePriorityFromListAction] Not authenticated");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    console.error("[togglePriorityFromListAction] User not found:", email);
    return;
  }

  const word = await prisma.word.findFirst({
    where: {
      id: parsed.data.wordId,
      userId: user.id,
    },
    select: { id: true },
  });
  if (!word) {
    console.error("[togglePriorityFromListAction] Word not found or not owned:", parsed.data.wordId);
    return;
  }

  try {
    await prisma.word.update({
      where: { id: word.id },
      data: { isPriority: parsed.data.nextPriority === "true" },
    });
    revalidatePath("/app/library");
    revalidatePath(`/app/library/${word.id}`);
    revalidatePath("/app/today");
  } catch (error) {
    console.error("[togglePriorityFromListAction] DB update failed:", error);
  }
}

export async function deleteWordFromListAction(formData: FormData): Promise<void> {
  const parsed = listWordActionSchema.safeParse({
    wordId: formData.get("wordId"),
  });

  if (!parsed.success) {
    console.error("[deleteWordFromListAction] Invalid input:", parsed.error.flatten());
    return;
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    console.error("[deleteWordFromListAction] Not authenticated");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    console.error("[deleteWordFromListAction] User not found:", email);
    return;
  }

  const word = await prisma.word.findFirst({
    where: {
      id: parsed.data.wordId,
      userId: user.id,
    },
    select: { id: true },
  });
  if (!word) {
    console.error("[deleteWordFromListAction] Word not found or not owned:", parsed.data.wordId);
    return;
  }

  try {
    await prisma.word.delete({
      where: { id: word.id },
    });
    revalidatePath("/app/library");
    revalidatePath("/app/today");
  } catch (error) {
    console.error("[deleteWordFromListAction] DB delete failed:", error);
  }
}
