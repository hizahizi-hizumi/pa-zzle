import {
  encodeZukanSheet,
  type ZukanSheetRasterRequest,
} from "@/features/zukan/ui/zukan-sheet-preview";

type WorkerScope = {
  addEventListener(
    type: "message",
    listener: (
      event: MessageEvent<{ id: number; request: ZukanSheetRasterRequest }>,
    ) => void,
  ): void;
  postMessage(message: { id: number; blob: Blob | null }): void;
};

const scope = globalThis as unknown as WorkerScope;

scope.addEventListener("message", (event) => {
  const { id, request } = event.data;
  encodeZukanSheet(request).then(
    (blob) => scope.postMessage({ id, blob }),
    () => scope.postMessage({ id, blob: null }),
  );
});
