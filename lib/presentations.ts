export type SlideType = "title" | "poll" | "wordcloud" | "content" | "image";

export type Slide = {
  id: string;
  type: SlideType;
  title: string;
  body: string;
  accent: string;
};

export type PresentationRecord = {
  id: string;
  user_id: string;
  title: string;
  slides: Slide[];
  updated_at: string;
  created_at?: string;
};

export const defaultSlides: Slide[] = [
  {
    id: "slide-1",
    type: "title",
    title: "Untitled presentation",
    body: "Start with a crisp opening for your audience.",
    accent: "from-cyan-300 to-emerald-300",
  },
];

export function getPresentationTitle(slides: Slide[]) {
  return slides[0]?.title?.trim() || "Untitled presentation";
}

export function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
