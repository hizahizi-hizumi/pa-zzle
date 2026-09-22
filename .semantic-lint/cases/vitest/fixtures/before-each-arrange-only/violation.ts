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
