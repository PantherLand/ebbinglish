"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  updateStudyConfigAction,
  type UpdateStudyConfigState,
} from "./actions";

type StudyConfigFormProps = {
  wordId: string;
  isPriority: boolean;
  manualCategory: string | null;
};

const initialState: UpdateStudyConfigState = {
  status: "idle",
};

export default function StudyConfigForm({
  wordId,
  isPriority,
  manualCategory,
}: StudyConfigFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    updateStudyConfigAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      window.dispatchEvent(
        new CustomEvent("ebbinglish:toast", {
          detail: {
            message: state.message,
            type: "success",
            durationMs: 1800,
          },
        }),
      );
    }
  }, [state.message, state.status]);

  const submitForm = () => {
    if (pending) {
      return;
    }
    formRef.current?.requestSubmit();
  };

  return (
    <form action={formAction} className="space-y-3 rounded-lg border p-4" ref={formRef}>
      <h2 className="text-base font-semibold">Study settings</h2>

      <input name="wordId" type="hidden" value={wordId} />

      <label className="flex items-center gap-2 text-sm">
        <input
          className="h-4 w-4"
          defaultChecked={isPriority}
          name="isPriority"
          onChange={submitForm}
          type="checkbox"
        />
        <span>Priority review (focus this word first)</span>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-gray-700">Manual category</span>
        <input
          className="w-full rounded-md border px-3 py-2"
          defaultValue={manualCategory ?? ""}
          list="word-category-options"
          maxLength={40}
          name="manualCategory"
          onBlur={submitForm}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitForm();
            }
          }}
          placeholder="e.g. IELTS / Work / Travel"
        />
        <datalist id="word-category-options">
          <option value="IELTS" />
          <option value="Work" />
          <option value="Travel" />
          <option value="Academic" />
          <option value="Daily" />
        </datalist>
      </label>

      {state.status === "error" ? (
        <p
          className="text-sm text-red-700"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
