import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import type {
  WaterSortBottle,
  WaterSortState,
} from "@/games/water-sort/game/state";
import type { WaterSortOperation } from "@/games/water-sort/hooks/use-water-sort-game";
import { getWaterColorView } from "./water-bottle/get-water-color-view";
import { WaterBottle } from "./water-bottle/WaterBottle";

const pourAnimationDurationMs = 1600;
const pourTransferStartOffset = 0.38;
const pourTransferEndOffset = 0.72;
const sourcePourLayerZIndex = 70;
const streamPourLayerZIndex = 69;
const destinationPourLayerZIndex = 65;

type BottleRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PourPresentation = {
  id: number;
  operationId: number;
  sourceBottleIndex: number;
  destinationBottleIndex: number;
  sourceBefore: WaterSortBottle;
  sourceAfter: WaterSortBottle;
  destinationBefore: WaterSortBottle;
  destinationAfter: WaterSortBottle;
  pourColorIndex: number;
  isClearingMove: boolean;
  sourceRect: BottleRect;
  destinationRect: BottleRect;
};

type WaterSortBoardProps = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  onSelectBottle: (bottleIndex: number) => void;
  interactionDisabled?: boolean;
  onPourComplete?: (operationId: number) => void;
  onClearingPourComplete?: () => void;
};

export function WaterSortBoard({
  state,
  sourceBottleIndex,
  operation,
  onSelectBottle,
  interactionDisabled = false,
  onPourComplete,
  onClearingPourComplete,
}: WaterSortBoardProps) {
  const bottleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const nextPresentationId = useRef(0);
  const [pourPresentations, setPourPresentations] = useState<
    readonly PourPresentation[]
  >([]);

  const finishPresentation = useCallback((presentationId: number) => {
    setPourPresentations((current) =>
      current.filter((presentation) => presentation.id !== presentationId),
    );
  }, []);

  useEffect(() => {
    if (!operation) {
      setPourPresentations([]);
      return;
    }
    if (operation.type === "invalid") {
      animateInvalidBottle(bottleRefs.current[operation.bottleIndex]);
      return;
    }
    if (operation.type !== "poured") return;

    const sourceBottle = bottleRefs.current[operation.sourceBottleIndex];
    const destinationBottle =
      bottleRefs.current[operation.destinationBottleIndex];
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!sourceBottle || !destinationBottle || prefersReducedMotion) {
      onPourComplete?.(operation.id);
      if (operation.isClearingMove) onClearingPourComplete?.();
      return;
    }

    const sourceBefore =
      operation.stateBefore[operation.sourceBottleIndex] ?? [];
    const pourColorIndex = sourceBefore[sourceBefore.length - 1];
    if (pourColorIndex === undefined) {
      onPourComplete?.(operation.id);
      if (operation.isClearingMove) onClearingPourComplete?.();
      return;
    }

    const presentation: PourPresentation = {
      id: nextPresentationId.current++,
      operationId: operation.id,
      sourceBottleIndex: operation.sourceBottleIndex,
      destinationBottleIndex: operation.destinationBottleIndex,
      sourceBefore,
      sourceAfter: operation.stateAfter[operation.sourceBottleIndex] ?? [],
      destinationBefore:
        operation.stateBefore[operation.destinationBottleIndex] ?? [],
      destinationAfter:
        operation.stateAfter[operation.destinationBottleIndex] ?? [],
      pourColorIndex,
      isClearingMove: operation.isClearingMove,
      sourceRect: captureRect(sourceBottle),
      destinationRect: captureRect(destinationBottle),
    };

    setPourPresentations((current) => [
      ...current.filter(
        (activePresentation) =>
          activePresentation.sourceBottleIndex !==
            operation.sourceBottleIndex &&
          activePresentation.destinationBottleIndex !==
            operation.sourceBottleIndex &&
          activePresentation.sourceBottleIndex !==
            operation.destinationBottleIndex,
      ),
      presentation,
    ]);
  }, [operation, onPourComplete, onClearingPourComplete]);

  const selectBottle = (bottleIndex: number) => {
    if (interactionDisabled) return;
    if (sourceBottleIndex === null) {
      setPourPresentations((current) =>
        current.filter(
          (presentation) =>
            presentation.sourceBottleIndex !== bottleIndex &&
            presentation.destinationBottleIndex !== bottleIndex,
        ),
      );
    }
    onSelectBottle(bottleIndex);
  };

  const animatedBottleIndexes = new Set(
    pourPresentations.flatMap((presentation) => [
      presentation.sourceBottleIndex,
      presentation.destinationBottleIndex,
    ]),
  );
  const layout = getBoardLayout(state.length);

  return (
    <>
      <fieldset
        className="grid w-full items-end justify-center border-0 p-0"
        style={{
          gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
          columnGap: layout.columnGap,
          rowGap: layout.rowGap,
          width: layout.width,
        }}
        aria-label="г‚«гѓ©гѓјг‚¦г‚©гѓјг‚їгѓјг‚Ѕгѓјгѓ€з›¤йќў"
      >
        {state.map((bottle, bottleIndex) => {
          const bottleLabel = `гѓњгѓ€гѓ« ${bottleIndex + 1}`;
          const contents =
            bottle.length === 0
              ? "з©є"
              : bottle
                  .map((colorIndex) => getWaterColorView(colorIndex).name)
                  .join("гЂЃ");
         ЫЫњЭ\ФЫЭ\ЩHH›ЭR[™^OOHЫЭ\ЩP›ЭR[™^В€ЫЫњЭ\Р[љ[X]YH[љ[X]Y›ЭR[™^\Лљ\К›ЭR[™^
NВ‚€™]\›€
€ќ]Ы‚€Щ^O^Ш›ЭSX™[B€™YЏ^К[[Y[ќ
HO€В€›ЭT™YњЛЭ\њ™[ќШ›ЭR[™^HH[[Y[ќВ€_B€\OHќ]Ы€‚€\љXK[X™[^Ш	Ш›ЭSX™[N€	ШЫЫќ[ќЯXB€\љXK\™\ЬЩY^Ъ\ФЫЭ\Щ_B€ЫђЫXЪП^К
HO€Щ[XЭ›ЭJ›ЭR[™^
_B€Ы\ЬУ[YOHњ™[]]™H\ЬXЭVМЊН—HЛYќ[ЬљYЪ[‹]ЬЭ\њЫЬ‹\Ъ[ќ\€ЭXЪ[X[љ\[][Ы€›Э[™YX‹VМKЌ\™[WH[њЪ][Ы‹][њЩ›Ь›H\][Ы‹LMLX\ЩK[Э]›ШЭ\Л]љ\ЪX›N›Э][™K[›Ы™H›ШЭ\Л]љ\ЪX›Nњљ[™ЛL€›ШЭ\Л]љ\ЪX›Nњљ[™Л\љ[™И›ШЭ\Л]љ\ЪX›Nњљ[™Л[Щ™њЩ]M‚€\ШX›Y^Ъ[ќ\XЭ[Ы‘\ШX›YB€‚€Ь[‚€Ы\ЬУ[YO^ШXњЫЫ]H[њЩ]L	Ъ\Р[љ[X]YИљ[ќљ\ЪX›H€€€џXB€‚€Ш]\ђ›ЭHЫЫќ[ќП^Ш›Э_HЩ[XЭY^Ъ\ФЫЭ\Щ_HП‚€ЬЬ[Џ‚€Шќ]ЫЏ‚€
NВ€J_B€ЩљY[Щ]‚‚€ЬЭ\”™\Щ[ќ][ЫњЛ›X\

™\Щ[ќ][ЫЉHO€
€Э\”ЫЭ\ЩS^Y\‚€Щ^O^Ь™\Щ[ќ][Ы‹љYB€™\Щ[ќ][ЫЏ^Ь™\Щ[ќ][ЫџB€Ы‘љ[љ\Ъ^Щљ[љ\Ъ™\Щ[ќ][ЫџB€Ы”Э\ђЫЫ\]O^ЫЫ”Э\ђЫЫ\]_B€ЫђЫX\љ[™ФЭ\ђЫЫ\]O^ЫЫђЫX\љ[™ФЭ\ђЫЫ\]_B€П‚€
J_B€ЩЬ›Э\™\Щ[ќ][ЫњРћQ\Э[][ЫЉЭ\”™\Щ[ќ][ЫњКK›X\
€
™\Щ[ќ][ЫњКHO€
€Э\‘\Э[][Ы“^Y\‚€Щ^O^Ь™\Щ[ќ][ЫњЦМOЛ™\Э[][Ыђ›ЭR[™^B€™\Щ[ќ][ЫњП^Ь™\Щ[ќ][ЫњЯB€П‚€
K€
_B€П‚€
NВџB‚™ќ[Э[Ы€Э\”ЫЭ\ЩS^Y\ЉВ€™\Щ[ќ][Ы‹€Ы‘љ[љ\Ъ€Ы”Э\ђЫЫ\]K€ЫђЫX\љ[™ФЭ\ђЫЫ\]KџN€В€™\Щ[ќ][ЫЋ€Э\”™\Щ[ќ][ЫЋВ€Ы‘љ[љ\Ъ€
™\Щ[ќ][Ы’Y€ќ[X™\ЉHO€›ЪYВ€Ы”Э\ђЫЫ\]OО€
Ь\][Ы’Y€ќ[X™\ЉHO€›ЪYВ€ЫђЫX\љ[™ФЭ\ђЫЫ\]OО€

HO€›ЪYВџJHВ€ЫЫњЭЫЭ\ЩT™Y€H\ЩT™YЏS]‘[[Y[ќЉќ[
NВ€ЫЫњЭЭ™X[T™Y€H\ЩT™YЏS]‘[[Y[ќЉќ[
NВ€ЫЫњЭЫЭ\ЩU[њЩ™\”™Y€H\ЩT™YЏSЬ[‘[[Y[ќЉќ[
NВ‚€\ЩQY™™XЭ


HO€В€ЫЫњЭЫЭ\ЩQ[[Y[ќHЫЭ\ЩT™Y‹Э\њ™[ќВ€ЫЫњЭЭ™X[Q[[Y[ќHЭ™X[T™Y‹Э\њ™[ќВ€Y€
\ЫЭ\ЩQ[[Y[ќЛ[љ[X]JHВ€Ы‘љ[љ\Ъ
™\Щ[ќ][Ы‹љY
NВ€Ы”Э\ђЫЫ\]OЛЉ™\Щ[ќ][Ы‹›Ь\][Ы’Y
NВ€Y€
™\Щ[ќ][Ы‹љ\РЫX\љ[™У[Э™JHВ€ЫђЫX\љ[™ФЭ\ђЫЫ\]OЛЉ
NВ€B€™]\›ЋВ€B‚€ЫЫњЭИЫЭ\ЩT™XЭ\Э[][Ы”™XЭHH™\Щ[ќ][ЫЋВ€ЫЫњЭ[VH\Э[][Ы”™XЭ›YќHЫЭ\ЩT™XЭ›YќВ€ЫЫњЭ[VHH\Э[][Ыђ›ЭT™XЭќЬHЫЭ\ЩT™XЭќЬВ€ЫЫњЭЭ™\–HH[VHHЫЭ\ЩT™XЭљZYЪ
€ЌMNВ€ЫЫњЭ\™XЭ[Ы€H[VЏHИH€LNВ€ЫЫњЭЫЭ\ЩU[њЩ™\‘[[Y[ќHЫЭ\ЩU[њЩ™\”™Y‹Э\њ™[ќВ€]XЭ]™HHќYNВ‚€ЫЫњЭЫЭ\ЩP[љ[X][Ы€HЫЭ\ЩQ[[Y[ќ[љ[X]J€В€В€[њЩ›Ь›N€ќ[њЫ]J
H›Э]JYКH‹€Щ™њЩ]€€X\Ъ[™О€™X\ЩK[Э]‹€K€В€[њЩ›Ь›N€ќ[њЫ]JM
H›Э]JYКH‹€Щ™њЩ]€Њ‹€X\Ъ[™О€ЭXљXЛX™^љY\ЉЊЊ‹ЌЊKЊН‹JH‹€K€В€[њЩ›Ь›N€[њЫ]J	Щ[V\	ЪЭ™\–_\
H›Э]JYКX€Щ™њЩ]€Њ‹€X\Ъ[™О€™X\ЩKZ[‹[Э]‹€K€В€[њЩ›Ь›N€[њЫ]J	Щ[V\	ЪЭ™\–_\
H›Э]J	Щ\™XЭ[Ы€
€ЋYYКX€Щ™њЩ]€ЊМ‹€X\Ъ[™О€™X\ЩK[Э]‹€K€В€[њЩ›Ь›N€[њЫ]J	Щ[V\	ЪЭ™\–_\
H›Э]J	Щ\™XЭ[Ы€
€ЋYYКX€Щ™њЩ]€ЌН‹€X\Ъ[™О€™X\ЩKZ[€‹€K€В€[њЩ›Ь›N€[њЫ]J	Щ[V\	ЪЭ™\–_\
H›Э]JYКX€Щ™њЩ]€Ћ‹€X\Ъ[™О€ЭXљXЛX™^љY\ЉЊЊ‹ЌЊKЊН‹JH‹€K€И[њЩ›Ь›N€ќ[њЫ]J
H›Э]JYКH‹Щ™њЩ]€HK€K€В€\][ЫЋ€Э\ђ[љ[X][Ы‘\][Ы“\Л€X\Ъ[™О€›[™X\€‹€K€
NВ‚€ЫЫњЭЭ™X[P[љ[X][Ы€HЭ™X[Q[[Y[ќЛ[љ[X]OЛЉ€В€ИЬXЪ]N€[њЩ›Ь›N€њШШ[VJЊMJH‹Щ™њЩ]€K€ИЬXЪ]N€[њЩ›Ь›N€њШШ[VJЊMJH‹Щ™њЩ]€ЊМ€K€В€ЬXЪ]N€ЋK€[њЩ›Ь›N€њШШ[VJJH‹€Щ™њЩ]€Э\•[њЩ™\”Э\ќЩ™њЩ]€K€ИЬXЪ]N€ЋK[њЩ›Ь›N€њШШ[VJJH‹Щ™њЩ]€ЌИK€ИЬXЪ]N€[њЩ›Ь›N€њШШ[VJЊНJH‹Щ™њЩ]€ЌНИK€ИЬXЪ]N€[њЩ›Ь›N€њШШ[VJЊMJH‹Щ™њЩ]€HK€K€И\][ЫЋ€Э\ђ[љ[X][Ы‘\][Ы“\ЛX\Ъ[™О€›[™X\€€K€
NВ‚€ЫЫњЭЫЭ\ЩU[њЩ™\ђ[љ[X][Ы€HЫЭ\ЩU[њЩ™\‘[[Y[ќЛ[љ[X]OЛЉ€В€И[њЩ›Ь›N€њШШ[VJJH‹Щ™њЩ]€K€И[њЩ›Ь›N€њШШ[VJJH‹Щ™њЩ]€Э\•[њЩ™\”Э\ќЩ™њЩ]K€И[њЩ›Ь›N€њШШ[VJ
H‹Щ™њЩ]€Э\•[њЩ™\‘[™Щ™њЩ]K€И[њЩ›Ь›N€њШШ[VJ
H‹Щ™њЩ]€HK€K€И\][ЫЋ€Э\ђ[љ[X][Ы‘\][Ы“\ЛX\Ъ[™О€›[™X\€‹љ[€™›ЬќШ\™И€K€
NВ€›ЪYЫЭ\ЩP[љ[X][Ы‹™љ[љ\ЪYќ[Љ€

HO€В€Y€
XXЭ]™JHВ€™]\›ЋВ€B€Ы‘љ[љ\Ъ
™\Щ[ќ][Ы‹љY
NВ€Ы”Э\ђЫЫ\]OЛЉ™\Щ[ќ][Ы‹›Ь\][Ы’Y
NВ€Y€
™\Щ[ќ][Ы‹љ\РЫX\љ[™У[Э™JHВ€ЫђЫX\љ[™ФЭ\ђЫЫ\]OЛЉ
NВ€B€K€

HO€[™Yљ[™Y€
NВ‚€™]\›€

HO€В€XЭ]™HH[ЩNВ€ЫЭ\ЩP[љ[X][Ы‹Ш[Щ[

NВ€Э™X[P[љ[X][ЫЏЛШ[Щ[

NВ€ЫЭ\ЩU[њЩ™\ђ[љ[X][ЫЏЛШ[Щ[

NВ€NВ€KЫЫ”Э\ђЫЫ\]KЫђЫX\љ[™ФЭ\ђЫЫ\]KЫ‘љ[љ\Ъ™\Щ[ќ][Ы—JNВ‚€™]\›€Ь™X]TЬќ[
€‚€]‚€™YЏ^ЬЫЭ\ЩT™YџB€\љXKZY[ЏHќќYH‚€Ы\ЬУ[YOHњЪ[ќ\‹Y]™[ќЛ[›Ы™Hљ^Y\ЬXЭVМЊН—HЬљYЪ[‹]Ь›Э[™YX‹VМKЌ\™[WHЪ[XЪ[™ЩK][њЩ›Ь›H‚€Э[O^ЩЩ]Э™\›^TЭ[J™\Щ[ќ][Ы‹њЫЭ\ЩT™XЭЫЭ\ЩTЭ\“^Y\–’[™^
_B€‚€Ш]\ђ›ЭB€ЫЫќ[ќП^Ь™\Щ[ќ][Ы‹њЫЭ\ЩPYќ\џB€Ш]\“Э™\›^O^В€[њЩ™\“\]ZYљY]В€[њЩ™\Џ^ЮВ€ЫЫЬ’[™^€™\Щ[ќ][Ы‹њЭ\ђЫЫЬ’[™^€Э\ќЫЭ€™\Щ[ќ][Ы‹њЫЭ\ЩPYќ\‹›[™Э€ЫЭЫЭ[ќ‚€™\Щ[ќ][Ы‹њЫЭ\ЩP™Y›Ь™K›[™ЭB€™\Щ[ќ][Ы‹њЫЭ\ЩPYќ\‹›[™Э€[[Y[ќ™YЋ€ЫЭ\ЩU[њЩ™\”™Y‹€[љ]X[ШШ[VN€K€_B€П‚€B€П‚€Щ]Џ‚€]‚€™YЏ^ЬЭ™X[T™YџB€\љXKZY[ЏHќќYH‚€Ы\ЬУ[YOHњЪ[ќ\‹Y]™[ќЛ[›Ы™Hљ^YЬљYЪ[‹]Ь›Э[™YYќ[ЬXЪ]KLЪ[XЪ[™ЩK][њЩ›Ь›H‚€Э[O^ЩЩ]Э\”Э™X[TЭ[J™\Щ[ќ][ЫЉ_B€П‚€П‹€ШЭ[Y[ќ›ЩK€
NВџB‚™ќ[Э[Ы€Э\‘\Э[][Ы“^Y\ЉВ€™\Щ[ќ][ЫњЛџN€В€™\Щ[ќ][ЫњО€™XYЫ›HЭ\”™\Щ[ќ][Ы–ЧNВџJHВ€ЫЫњЭљ\њЭ™\Щ[ќ][Ы€H™\Щ[ќ][ЫњЦМNВ€Y€
Yљ\њЭ™\Щ[ќ][ЫЉHВ€™]\›€ќ[В€B‚€™]\›€Ь™X]TЬќ[
€]‚€\љXKZY[ЏHќќYH‚€Ы\ЬУ[YOHњЪ[ќ\‹Y]™[ќЛ[›Ы™Hљ^Y\ЬXЭVМЊН—H›Э[™YX‹VМKЌ\™[WH‚€Э[O^ЩЩ]Э™\›^TЭ[J€љ\њЭ™\Щ[ќ][Ы‹™\Э[][Ы”™XЭ€\Э[][Ы”Э\“^Y\–’[™^€
_B€‚€Ш]\ђ›ЭB€ЫЫќ[ќП^Щљ\њЭ™\Щ[ќ][Ы‹™\Э[][Ыђ™Y›Ь™_B€Ш]\“Э™\›^O^Ь™\Щ[ќ][ЫњЛ›X\

™\Щ[ќ][ЫЉHO€
€[љ[X]Y\Э[][Ы•[њЩ™\‚€Щ^O^Ь™\Щ[ќ][Ы‹љYB€™\Щ[ќ][ЫЏ^Ь™\Щ[ќ][ЫџB€П‚€
J_B€П‚€Щ]Џ‹€ШЭ[Y[ќ›ЩK€
NВџB‚™ќ[Э[Ы€[љ[X]Y\Э[][Ы•[њЩ™\ЉВ€™\Щ[ќ][Ы‹џN€В€™\Щ[ќ][ЫЋ€Э\”™\Щ[ќ][ЫЋВџJHВ€ЫЫњЭ[њЩ™\”™Y€H\ЩT™YЏSЬ[‘[[Y[ќЉќ[
NВ‚€\ЩQY™™XЭ


HO€В€ЫЫњЭ[љ[X][Ы€H[њЩ™\”™Y‹Э\њ™[ќЛ[љ[X]OЛЉ€В€И[њЩ›Ь›N€њШШ[VJ
H‹Щ™њЩ]€K€И[њЩ›Ь›N€њШШ[VJ
H‹Щ™њЩ]€Э\•[њЩ™\”Э\ќЩ™њЩ]K€И[њЩ›Ь›N€њШШ[VJJH‹Щ™њЩ]€Э\•[њЩ™\‘[™Щ™њЩ]K€И[њЩ›Ь›N€њШШ[VJJH‹Щ™њЩ]€HK€K€И\][ЫЋ€Э\ђ[љ[X][Ы‘\][Ы“\ЛX\Ъ[™О€›[™X\€‹љ[€™›ЬќШ\™И€K€
NВ‚€™]\›€

HO€[љ[X][ЫЏЛШ[Щ[

NВ€KЧJNВ‚€™]\›€
€[њЩ™\“\]ZYљY]В€[њЩ™\Џ^ЮВ€ЫЫЬ’[™^€™\Щ[ќ][Ы‹њЭ\ђЫЫЬ’[™^€Э\ќЫЭ€™\Щ[ќ][Ы‹™\Э[][Ыђ™Y›Ь™K›[™Э€ЫЭЫЭ[ќ‚€™\Щ[ќ][Ы‹™\Э[][ЫђYќ\‹›[™ЭB€™\Щ[ќ][Ы‹™\Э[][Ыђ™Y›Ь™K›[™Э€[[Y[ќ™YЋ€[њЩ™\”™Y‹€[љ]X[ШШ[VN€€_B€П‚€
NВџB‚™ќ[Э[Ы€[њЩ™\“\]ZYљY]КИ[њЩ™\€N€И[њЩ™\Ћ€[њЩ™\“\]ZYJHВ€™]\›€
€Ь[‚€™YЏ^Э[њЩ™\‹™[[Y[ќ™YџB€Ы\ЬУ[YOHXњЫЫ]H[њЩ]^LЬљYЪ[‹X›ЭЫHЪ[XЪ[™ЩK][њЩ›Ь›H‚€Э[O^ЮВ€›ЭЫN€	Э[њЩ™\‹њЭ\ќЫЭ
€Ќ_IX€ZYЪ€	Э[њЩ™\‹њЫЭЫЭ[ќ
€Ќ_IX€XЪЩЬ›Э[™ЫЫЬЋ€Щ]Ш]\ђЫЫЬ•љY]К[њЩ™\‹ЫЫЬ’[™^
KЫЫЬ‹€[њЩ›Ь›N€ШШ[VJ	Э[њЩ™\‹љ[љ]X[ШШ[V_JX€_B€П‚€
NВџB‚™ќ[Э[Ы€Ь›Э\™\Щ[ќ][ЫњРћQ\Э[][ЫЉ€™\Щ[ќ][ЫњО€™XYЫ›HЭ\”™\Щ[ќ][Ы–ЧKЉN€™XYЫ›H
™XYЫ›HЭ\”™\Щ[ќ][Ы–ЧJVЧHВ€ЫЫњЭЬ›Э\ИH™]ИX\ќ[X™\‹Э\”™\Щ[ќ][Ы–ЧOЉ
NВ‚€›Ь€
ЫЫњЭ™\Щ[ќ][Ы€Щ€™\Щ[ќ][ЫњКHВ€ЫЫњЭЭ\њ™[ќHЬ›Э\Л™Щ]
™\Щ[ќ][Ы‹™\Э[][Ыђ›ЭR[™^
HПИЧNВ€Э\њ™[ќњ\Ъ
™\Щ[ќ][ЫЉNВ€Ь›Э\ЛњЩ]
™\Щ[ќ][Ы‹™\Э[][Ыђ›ЭR[™^Э\њ™[ќ
NВ€B‚€™]\›€Л‹‹™Ь›Э\Лќ[Y\К
WNВџB‚ќ\H[њЩ™\“\]ZYHВ€ЫЫЬ’[™^€ќ[X™\ЋВ€Э\ќЫЭ€ќ[X™\ЋВ€ЫЭЫЭ[ќ€ќ[X™\ЋВ€[[Y[ќ™YЋ€™Y“Шљ™XЭSЬ[‘[[Y[ќќ[ЋВ€[љ]X[ШШ[VN€ќ[X™\ЋВџNВ‚™ќ[Э[Ы€Щ]›Ш\™^[Э]
›ЭPЫЭ[ќ€ќ[X™\ЉHВ€ЫЫњЭЫЫ[[ђЫЭ[ќHX]›X^
ЛX]ЩZ[
›ЭPЫЭ[ќИЉJNВ‚€Y€
ЫЫ[[ђЫЭ[ќЏHЉHВ€™]\›€В€ЫЫ[[ђЫЭ[ќ€ЪY€›Z[ЉL	KЫ[\
НЌњќЛMМ
JH‹€ЫЫ[[‘Ш\€L€›ЭСШ\€Н€NВ€B€Y€
ЫЫ[[ђЫЭ[ќOOHJHВ€™]\›€В€ЫЫ[[ђЫЭ[ќ€ЪY€›Z[ЉL	KЫ[\
НЊќЛLЊ
JH‹€ЫЫ[[‘Ш\€M€›ЭСШ\€€NВ€B€Y€
ЫЫ[[ђЫЭ[ќOOH
HВ€™]\›€В€ЫЫ[[ђЫЭ[ќ€ЪY€›Z[ЉL	KЫ[\
МЊќЛL
JH‹€ЫЫ[[‘Ш\€M‹€›ЭСШ\€‹€NВ€B€™]\›€В€ЫЫ[[ђЫЭ[ќ€ЪY€›Z[ЉL	KЫ[\
ЌLМќќЛН
JH‹€ЫЫ[[‘Ш\€N€›ЭСШ\€€NВџB‚™ќ[Э[Ы€[љ[X]R[ќ[Y›ЭJ[[Y[ќ€Sќ]Ы‘[[Y[ќќ[[™Yљ[™Y
HВ€Y€
Y[[Y[ќЛ[љ[X]JHВ€™]\›ЋВ€B‚€[[Y[ќ[љ[X]J€В€И[њЩ›Ь›N€ќ[њЫ]V

H€K€И[њЩ›Ь›N€ќ[њЫ]V
M
H€K€И[њЩ›Ь›N€ќ[њЫ]V

H€K€И[њЩ›Ь›N€ќ[њЫ]V
Lњ
H€K€И[њЩ›Ь›N€ќ[њЫ]V

H€K€K€И\][ЫЋ€ЊЊX\Ъ[™О€™X\ЩK[Э]€K€
NВџB‚™ќ[Э[Ы€Ш\\™T™XЭ
[[Y[ќ€S[[Y[ќ
N€›ЭT™XЭВ€ЫЫњЭ™XЭH[[Y[ќ™Щ]›Э[™[™РЫY[ќ™XЭ

NВ€™]\›€В€Yќ€™XЭ›Yќ€Ь€™XЭќЬ€ЪY€™XЭќЪY€ZYЪ€™XЭљZYЪ€NВџB‚™ќ[Э[Ы€Щ]Э™\›^TЭ[J™XЭ€›ЭT™XЭ’[™^€ќ[X™\ЉHВ€™]\›€В€Yќ€	Ь™XЭ›Yќ\€Ь€	Ь™XЭќЬ\€ЪY€	Ь™XЭќЪY\€ZYЪ€	Ь™XЭљZYЪ\€’[™^€NВџB‚™ќ[Э[Ы€Щ]Э\”Э™X[TЭ[J™\Щ[ќ][ЫЋ€Э\”™\Щ[ќ][ЫЉHВ€ЫЫњЭИЫЭ\ЩT™XЭ\Э[][Ы”™XЭHH™\Щ[ќ][ЫЋВ€ЫЫњЭЭ™X[UЬH\Э[][Ы”™XЭќЬHЫЭ\ЩT™XЭљZYЪ
€ЌMNВ€ЫЫњЭЭ™X[RZYЪH\Э[][Ы”™XЭќЬHЭ™X[UЬ
ИЋВ€ЫЫњЭЫЫЬ€HЩ]Ш]\ђЫЫЬ•љY]К™\Щ[ќ][Ы‹њЭ\ђЫЫЬ’[™^
KЫЫЬЋВ‚€™]\›€В€Yќ€	Щ\Э[][Ы”™XЭ›Yќ
И\Э[][Ы”™XЭќЪYИ€Hџ\€Ь€	ЬЭ™X[UЬ
ИЯ\€ЪY€Ќ‹€ZYЪ€	ЬЭ™X[RZYЪ\€XЪЩЬ›Э[™ЫЫЬЋ€ЫЫЬ‹€›ЮЪYЭО€\	ШЫЫЬџMЌ€’[™^€Э™X[TЭ\“^Y\–’[™^€NВџB