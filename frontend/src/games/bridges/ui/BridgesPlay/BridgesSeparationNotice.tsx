import { getSeparationNoticeLines } from "@/games/bridges/ui/BridgesPlay/separation-notice";

type BridgesSeparationNoticeProps = {
  groupCount: number;
};

export function BridgesSeparationNotice({
  groupCount,
}: BridgesSeparationNoticeProps) {
  const { situation, rule } = getSeparationNoticeLines(groupCount);
  return (
    <p className="text-center text-play-context">
      {situation}
      <br />
      {rule}
    </p>
  );
}
