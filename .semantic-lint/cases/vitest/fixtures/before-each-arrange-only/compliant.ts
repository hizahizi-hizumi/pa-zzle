describe("submitForm", () => {
  let form: Form;

  beforeEach(() => {
    form = createForm();
  });

  test("送信済みになること", () => {
    const result = submitForm(form);

    expect(result.status).toBe("submitted");
  });
});
