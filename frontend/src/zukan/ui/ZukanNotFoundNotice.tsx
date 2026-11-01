import { Link } from "@/router";

/** 今のアプリに無いゲームの図鑑を開こうとしたことを示し、記録へ戻る導線を出す。 */
export function ZukanNotFoundNotice() {
  return (
    <section className="mx-auto w-full max-w-3xl py-8 text-center">
      <h1 className="text-heading">図鑑が見つかりません</h1>
      <p className="mt-2 text-supporting text-muted-foreground">
        このパズルは、今のアプリの図鑑にありません。
      </p>
      <Link
        to="/records"
        className="mt-6 inline-block text-supporting font-medium underline underline-offset-4"
      >
        記録へ戻る
      </Link>
    </section>
  );
}
