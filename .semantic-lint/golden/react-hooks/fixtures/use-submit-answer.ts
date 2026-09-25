import { useEffect, useState } from "react";

export function useSubmitAnswer(answer: string, save: (answer: string) => void) {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) {
      save(answer);
    }
  }, [answer, save, submitted]);

  function submit() {
    setSubmitted(true);
  }

  return { submitted, submit };
}
