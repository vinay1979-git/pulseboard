"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  BarChart3,
  Copy,
  GripVertical,
  Heading1,
  Image,
  LayoutPanelTop,
  MonitorPlay,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPresentationTitle,
  type Slide,
  type SlideType,
} from "@/lib/presentations";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const slideTypeOptions: {
  type: SlideType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "title", label: "Title", icon: Heading1 },
  { type: "poll", label: "Poll", icon: BarChart3 },
  { type: "wordcloud", label: "Word cloud", icon: Sparkles },
  { type: "content", label: "Content", icon: Type },
  { type: "image", label: "Image", icon: Image },
];

function createSlide(type: SlideType): Slide {
  const option = slideTypeOptions.find((item) => item.type === type);
  const count = crypto.randomUUID();

  return {
    id: count,
    type,
    title: option ? `Untitled ${option.label}` : "Untitled slide",
    body: "Add prompts, talking points, or audience choices here.",
    accent: "from-indigo-300 to-cyan-300",
  };
}

function SortableThumbnail({
  slide,
  index,
  selected,
  onSelect,
}: {
  slide: Slide;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group grid w-full grid-cols-[auto_1fr] gap-3 rounded-md border border-slate-200/75 bg-white/70 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/12",
          selected && "border-cyan-300/70 bg-cyan-300/12",
          isDragging && "opacity-60",
        )}
      >
        <span
          className="mt-1 cursor-grab text-slate-400 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </span>
        <span>
          <span className="mb-2 block text-xs font-bold text-slate-400">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="line-clamp-2 block text-sm font-bold">
            {slide.title}
          </span>
          <span className="mt-1 block text-xs capitalize text-slate-500 dark:text-slate-400">
            {slide.type}
          </span>
        </span>
      </button>
    </div>
  );
}

export function PresentationBuilder({
  userId,
  email,
  presentationId,
  initialTitle,
  initialSlides,
}: {
  userId: string;
  email: string;
  presentationId: string;
  initialTitle: string;
  initialSlides: Slide[];
}) {
  const supabase = createClient();
  const [slides, setSlides] = useState(initialSlides);
  const [selectedSlideId, setSelectedSlideId] = useState(initialSlides[0].id);
  const [title, setTitle] = useState(initialTitle);
  const [saveLabel, setSaveLabel] = useState("Ready");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedSlide = useMemo(
    () => slides.find((slide) => slide.id === selectedSlideId) ?? slides[0],
    [selectedSlideId, slides],
  );

  async function savePresentation(nextSlides = slides) {
    setSaveLabel("Saving...");
    const nextTitle = title.trim() || getPresentationTitle(nextSlides);
    const now = new Date().toISOString();

    const { error } = await supabase.from("presentations").upsert({
      id: presentationId,
      user_id: userId,
      title: nextTitle,
      slides: nextSlides,
      updated_at: now,
    });

    setSaveLabel(error ? "Saved locally" : "Saved to Supabase");
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void savePresentation(slides);
    }, 900);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editingText =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void savePresentation();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        addSlide("title");
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSlide();
      }

      if (!editingText && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        deleteSlide();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function updateSelectedSlide(updates: Partial<Slide>) {
    setSlides((current) =>
      current.map((slide) =>
        slide.id === selectedSlide.id ? { ...slide, ...updates } : slide,
      ),
    );
  }

  function addSlide(type: SlideType) {
    const nextSlide = createSlide(type);
    setSlides((current) => [...current, nextSlide]);
    setSelectedSlideId(nextSlide.id);
  }

  function duplicateSlide() {
    const duplicate = {
      ...selectedSlide,
      id: crypto.randomUUID(),
      title: `${selectedSlide.title} copy`,
    };
    const selectedIndex = slides.findIndex((slide) => slide.id === selectedSlide.id);
    setSlides((current) => [
      ...current.slice(0, selectedIndex + 1),
      duplicate,
      ...current.slice(selectedIndex + 1),
    ]);
    setSelectedSlideId(duplicate.id);
  }

  function deleteSlide() {
    if (slides.length === 1) {
      return;
    }

    const selectedIndex = slides.findIndex((slide) => slide.id === selectedSlide.id);
    const nextSlides = slides.filter((slide) => slide.id !== selectedSlide.id);
    setSlides(nextSlides);
    setSelectedSlideId(nextSlides[Math.max(0, selectedIndex - 1)].id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setSlides((current) => {
      const oldIndex = current.findIndex((slide) => slide.id === active.id);
      const newIndex = current.findIndex((slide) => slide.id === over.id);
      return arrayMove(current, oldIndex, newIndex);
    });
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
            Builder
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">
            {title || "Untitled presentation"}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            Build Mentimeter-style slides with drag ordering, live preview, and
            autosave for {email}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-slate-200/80 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-600 backdrop-blur dark:border-white/10 dark:bg-white/8 dark:text-slate-300">
            {saveLabel}
          </span>
          <Button type="button" onClick={() => void savePresentation()}>
            <Save className="size-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid min-h-[720px] gap-4 xl:grid-cols-[280px_1fr_340px]">
        <aside className="rounded-lg border border-slate-200/75 bg-white/72 p-4 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Slides</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {slides.length}
            </span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={slides.map((slide) => slide.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 xl:max-h-[560px]">
                {slides.map((slide, index) => (
                  <SortableThumbnail
                    key={slide.id}
                    slide={slide}
                    index={index}
                    selected={slide.id === selectedSlide.id}
                    onSelect={() => setSelectedSlideId(slide.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-5 grid gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Add slide
            </p>
            <div className="grid grid-cols-2 gap-2">
              {slideTypeOptions.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => addSlide(item.type)}
                  className="flex h-16 flex-col items-center justify-center gap-1 rounded-md border border-slate-200/80 bg-white/60 text-xs font-semibold transition hover:-translate-y-0.5 hover:bg-cyan-300/12 dark:border-white/10 dark:bg-slate-950/30"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200/75 bg-white/72 p-4 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LayoutPanelTop className="size-5 text-cyan-700 dark:text-cyan-200" />
              <h2 className="font-bold">Editing canvas</h2>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-slate-950 dark:text-white"
                onClick={duplicateSlide}
              >
                <Copy className="size-4" />
                Duplicate
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={deleteSlide}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            </div>
          </div>

          <motion.div
            key={selectedSlide.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-[520px] rounded-lg border border-slate-200/75 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-slate-950/35"
          >
            <div
              className={`mb-5 flex h-44 items-end rounded-lg bg-gradient-to-br ${selectedSlide.accent} p-6 shadow-lg`}
            >
              <div className="rounded-md bg-slate-950/18 px-3 py-2 text-sm font-bold text-white backdrop-blur">
                {selectedSlide.type.toUpperCase()}
              </div>
            </div>

            <div className="grid gap-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Presentation name
                </label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="text-lg font-bold"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Slide title
                </label>
                <Input
                  value={selectedSlide.title}
                  onChange={(event) =>
                    updateSelectedSlide({ title: event.target.value })
                  }
                  className="text-lg font-bold"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Prompt or content
                </label>
                <textarea
                  value={selectedSlide.body}
                  onChange={(event) =>
                    updateSelectedSlide({ body: event.target.value })
                  }
                  className="min-h-36 w-full resize-none rounded-md border border-slate-300/70 bg-white/85 px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/40 dark:border-white/12 dark:bg-white/8 dark:text-white"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Interaction style
                </p>
                <div className="grid gap-2 sm:grid-cols-5">
                  {slideTypeOptions.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => updateSelectedSlide({ type: item.type })}
                      className={cn(
                        "flex h-12 items-center justify-center gap-2 rounded-md border border-slate-200/80 bg-white/70 text-sm font-semibold transition hover:bg-slate-950/5 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/12",
                        selectedSlide.type === item.type &&
                          "border-cyan-300/60 bg-cyan-300/15 text-cyan-800 dark:text-cyan-100",
                      )}
                    >
                      <item.icon className="size-4" />
                      <span className="hidden 2xl:inline">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-slate-200/75 bg-white/72 p-4 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
            <div className="mb-4 flex items-center gap-2">
              <MonitorPlay className="size-5 text-cyan-700 dark:text-cyan-200" />
              <h2 className="font-bold">Live preview</h2>
            </div>
            <motion.div
              key={`${selectedSlide.id}-preview`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`aspect-video rounded-lg bg-gradient-to-br ${selectedSlide.accent} p-5 text-white shadow-xl`}
            >
              <div className="flex h-full flex-col justify-between">
                <span className="w-fit rounded-md bg-slate-950/18 px-2 py-1 text-xs font-bold uppercase backdrop-blur">
                  {selectedSlide.type}
                </span>
                <div>
                  <h3 className="text-2xl font-black leading-tight">
                    {selectedSlide.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm font-medium text-white/88">
                    {selectedSlide.body}
                  </p>
                </div>
              </div>
            </motion.div>
          </section>

          <section className="rounded-lg border border-slate-200/75 bg-white/72 p-4 shadow-xl shadow-slate-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/9">
            <h2 className="font-bold">Shortcuts</h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              {[
                ["Ctrl/Cmd + S", "Save now"],
                ["Ctrl/Cmd + N", "New title slide"],
                ["Ctrl/Cmd + D", "Duplicate slide"],
                ["Delete", "Delete selected slide"],
              ].map(([keys, action]) => (
                <div
                  key={keys}
                  className="flex items-center justify-between rounded-md border border-slate-200/80 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-slate-950/30"
                >
                  <span>{action}</span>
                  <kbd className="rounded bg-slate-950/8 px-2 py-1 font-mono text-xs dark:bg-white/10">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          <Button type="button" className="w-full" onClick={() => addSlide("poll")}>
            <Plus className="size-4" />
            Add interactive slide
          </Button>
        </aside>
      </div>
    </div>
  );
}
