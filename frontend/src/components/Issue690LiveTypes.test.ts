import {
  _private,
  getIssue690QuerySelection,
} from "@/components/Issue690LiveTypes";

const { isIssue690PreviewHost } = _private;

describe("isIssue690PreviewHost", () => {
  test.each([
    "research-690-result-experience-redesign-pa-zzle.hizahizihizumi.workers.dev",
    "d780a420-pa-zzle.hizahizihizumi.workers.dev",
    "0123abcd-pa-zzle.hizahizihizumi.workers.dev",
  ])("比較用プレビューのホスト名を認識できること: %s", (hostname) => {
    const isPreview = isIssue690PreviewHost(hostname);

    expect(isPreview).toBe(true);
  });

  test.each([
    "pa-zzle.hizahizihizumi.workers.dev",
    "other.hizahizihizumi.workers.dev",
    "d780a420-pa-zzle.evil.example",
    "nothexzz-pa-zzle.hizahizihizumi.workers.dev",
    "localhost",
  ])("比較用以外のホスト名で有効化しないこと: %s", (hostname) => {
    const isPreview = isIssue690PreviewHost(hostname);

    expect(isPreview).toBe(false);
  });
});

describe("getIssue690QuerySelection", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  test("比較用の案が指定されていなければ06案を表示すること", () => {
    window.history.replaceState(null, "", "/?issue690Preview=1");

    const idea = getIssue690QuerySelection();

    expect(idea).toBe("06");
  });

  test("指定した比較案を維持すること", () => {
    window.history.replaceState(
      null,
      "",
      "/?issue690Preview=1&issue690Idea=03",
    );

    const idea = getIssue690QuerySelection();

    expect(idea).toBe("03");
  });
});
