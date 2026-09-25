import { beforeEach, describe, expect, test } from "vitest";

import {
  createForm,
  type Form,
  resetForm,
  type SubmitResult,
  submitForm,
} from "./form";

describe("submitForm", () => {
  let form: Form;
  let result: SubmitResult;

  beforeEach(() => {
    form = createForm();
    result = submitForm(form);
  });

  test("送信済みになること", () => {
    expect(result.status).toBe("submitted");
  });
});

describe("resetForm", () => {
  let form: Form;

  beforeEach(() => {
    form = createForm();
  });

  test("入力を空にすること", () => {
    const result = resetForm(form);

    expect(result.values).toEqual({});
  });
});
