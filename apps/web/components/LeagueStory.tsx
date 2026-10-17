"use client";

import { CheckIcon, ClockIcon, CopyIcon, GoalIcon, UsersIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { DeviceFrame } from "@krizaka/ui/step-showcase";
import { Tabs } from "@krizaka/ui/tabs";

import { STORY_STEPS, type StoryStep } from "@/lib/landing";

export interface LeagueStoryText {
  label: string;
  example: string;
  steps: Record<StoryStep, { title: string; text: string }>;
  leagueName: string;
  invite: string;
  copy: string;
  sportsOn: string;
  yourPick: string;
  locked: string;
  tableTitle: string;
  updated: string;
  season: string;
  round: string;
  cup: string;
  match: string;
  /** Names and points, in table order (the real scorer's, computed by the server). */
  members: { name: string; points: number }[];
  pick: string;
}

const STEP_ICONS = { create: UsersIcon, pick: ClockIcon, table: CheckIcon, season: GoalIcon } as const;

/** One screen of the phone: what the member sees at that step. Example screens drawn from the family's tokens. */
function Screen({ step, text }: { step: StoryStep; text: LeagueStoryText }) {
  const row = "flex items-center justify-between gap-2 rounded-lg border border-border-default bg-surface-1 px-3 py-2";
  return (
    <div className="flex h-full flex-col gap-3 bg-surface-0 p-4 text-sm text-fg">
      {step === "create" && (
        <>
          <p className="text-base font-semibold">{text.leagueName}</p>
          <p className="text-xs text-fg-muted">{text.sportsOn}</p>
          <div className={row}>
            <span className="truncate font-mono text-xs text-fg-secondary">{text.invite}</span>
            <Badge tone="accent">
              <CopyIcon size={12} aria-hidden /> {text.copy}
            </Badge>
          </div>
        </>
      )}
      {step === "pick" && (
        <>
          <p className="text-xs text-fg-muted">{text.match}</p>
          <p className="text-base font-semibold">{text.yourPick}</p>
          <div className="flex items-center justify-center gap-4 rounded-xl border border-border-default bg-surface-1 py-6 font-mono text-3xl font-semibold">
            <span>2</span>
            <span className="text-fg-muted">–</span>
            <span>1</span>
          </div>
          <p className="flex items-center gap-2 text-xs text-fg-muted">
            <ClockIcon size={14} aria-hidden /> {text.locked}
          </p>
        </>
      )}
      {step === "table" && (
        <>
          <p className="text-base font-semibold">{text.tableTitle}</p>
          <ol className="flex flex-col gap-2">
            {text.members.map((m, i) => (
              <li key={m.name} className={row}>
                <span className="font-mono text-xs text-fg-muted">{i + 1}</span>
                <span className="flex-1 font-medium">{m.name}</span>
                <span className="font-mono text-xs font-semibold">{m.points}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-fg-muted">{text.updated}</p>
        </>
      )}
      {step === "season" && (
        <>
          <p className="text-xs text-fg-muted">{text.season}</p>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="text-fg-accent [&_svg]:h-14 [&_svg]:w-14">
              <GoalIcon aria-hidden />
            </span>
            <p className="text-base font-semibold">{text.members[0]?.name}</p>
            <p className="text-xs text-fg-muted">{text.cup}</p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The journey in four steps — create the league, pick, watch the table move, win the season — on one phone. The screens
 * are drawn here from the family's tokens and labelled as examples; the recorded clips replace them with
 * `StepShowcase` once a real league runs on dev (UX_DECISIONS §5).
 */
export function LeagueStory({ text }: { text: LeagueStoryText }) {
  return (
    <Tabs.Root defaultValue="create" className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
      <div className="order-2 flex flex-col gap-4 md:order-1">
        <Tabs.List aria-label={text.label} className="flex-col items-stretch">
          {STORY_STEPS.map((id, i) => {
            const Icon = STEP_ICONS[id];
            return (
              <Tabs.Trigger key={id} value={id} className="h-auto justify-start gap-3 px-4 py-3 text-left">
                <span className="font-mono text-xs text-fg-accent">{String(i + 1).padStart(2, "0")}</span>
                <Icon size={18} aria-hidden />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{text.steps[id].title}</span>
                  <span className="text-xs font-normal text-fg-secondary">{text.steps[id].text}</span>
                </span>
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        <p className="text-xs text-fg-muted">{text.example}</p>
      </div>
      <div className="order-1 md:order-2">
        <DeviceFrame kind="phone">
          {STORY_STEPS.map((id) => (
            <Tabs.Content key={id} value={id} className="h-full">
              <Screen step={id} text={text} />
            </Tabs.Content>
          ))}
        </DeviceFrame>
      </div>
    </Tabs.Root>
  );
}
