"use client";

import { CopyIcon } from "@krizaka/icons";
import { krizakaFetch, useMutation } from "@krizaka/query";
import { Alert } from "@krizaka/ui/alert";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { useState } from "react";
import { z } from "zod";

import { errorKey } from "@/lib/client";
import { useSay } from "@/lib/i18n-client";

const invite = z.object({ token: z.string(), expiresAt: z.string() });

/** An invite link for the league: made on demand, shown once with its end date, copied in one tap. */
export function InviteCard({ leagueId, base, origin }: { leagueId: string; base: string; origin: string }) {
  const { say, locale } = useSay();
  const [link, setLink] = useState<{ url: string; until: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useMutation({ mutationFn: () => krizakaFetch(`/api/leagues/${leagueId}/invites`, { method: "POST", schema: invite }) });
  const make = async () => {
    setProblem(null);
    try {
      const r = await create.mutateAsync();
      setLink({ url: `${origin}${base}/join/${r.token}`, until: new Date(r.expiresAt).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium" }) });
    } catch (error) {
      setProblem(say(`errors.${errorKey(error)}`));
    }
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Card.Root className="flex flex-col gap-3 p-4" aria-labelledby="invite-title">
      <h2 id="invite-title" className="font-display text-base font-bold text-fg">
        {say("play.invite.title")}
      </h2>
      <p className="text-sm text-fg-secondary">{say("play.invite.description")}</p>
      {link ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-fg-muted" htmlFor="invite-link">
            {say("play.invite.link")}
          </label>
          <div className="flex gap-2">
            <input id="invite-link" readOnly value={link.url} className="min-w-0 flex-1 rounded-md border border-border-default bg-surface-1 px-3 py-2 font-mono text-xs text-fg" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" size="md" shape="cut" onClick={copy}>
              <CopyIcon size={16} aria-hidden /> {copied ? say("play.invite.copied") : say("play.invite.copy")}
            </Button>
          </div>
          <p className="text-xs text-fg-muted">{say("play.invite.expires", { date: link.until })}</p>
        </div>
      ) : (
        <Button variant="primary" size="md" shape="cut" onClick={make} className="w-fit">
          {say("play.invite.create")}
        </Button>
      )}
      {problem ? <Alert tone="danger">{problem}</Alert> : null}
    </Card.Root>
  );
}
