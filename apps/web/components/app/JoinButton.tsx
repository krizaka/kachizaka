"use client";

import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

const joined = z.object({ leagueId: z.string(), joined: z.boolean() });

/** « Join the league »: one action, then the league's page. */
export function JoinButton({ token, base }: { token: string; base: string }) {
  const { say } = useSay();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const join = useMutation({ mutationFn: () => krizakaFetch("/api/join", { method: "POST", json: { token }, schema: joined }) });
  const go = async () => {
    setProblem(null);
    try {
      const r = await join.mutateAsync();
      router.push(`${base}/leagues/${r.leagueId}`);
      router.refresh();
    } catch (error) {
      setProblem(say(`errors.${errorKey(error)}`));
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" size="lg" onClick={go} loading={join.isPending} className="w-fit">
        {say("play.join.action")}
      </Button>
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
    </div>
  );
}
