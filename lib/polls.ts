export type PollOption = {
  id: string;
  label: string;
};

export type PollSession = {
  id: string;
  question: string;
  options: PollOption[];
  locked: boolean;
  created_by?: string;
  updated_at?: string;
};

export type PollVote = {
  poll_id: string;
  participant_id: string;
  option_id: string;
  created_at?: string;
};

export const defaultPollSession: PollSession = {
  id: "demo",
  question: "What should PulseBoard help you build next?",
  locked: false,
  options: [
    { id: "strategy", label: "Strategy decks" },
    { id: "workshops", label: "Live workshops" },
    { id: "reports", label: "Analytics reports" },
    { id: "training", label: "Training sessions" },
  ],
};

export function countVotes(options: PollOption[], votes: PollVote[]) {
  return options.map((option) => ({
    ...option,
    votes: votes.filter((vote) => vote.option_id === option.id).length,
  }));
}
