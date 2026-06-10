import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { generateStory } from "@/utils/storyEngine";
import { generateIllustration, getFallbackIllustration } from "@/utils/imageGenerator";
import { extractLineArt, getFallbackLineArt, isSvgDataUrl } from "@/utils/lineArtExtractor";
import { useStore } from "@/store/useStore";
import type { StoryBook, BookPage } from "@/store/useStore";
import type { StoryPageTemplate } from "@/utils/storyEngine";

const stageTexts = ["正在构思故事...", "正在绘制插画...", "正在提取线稿...", "正在装订成书..."];

const stars = [
  { emoji: "⭐", top: "8%", left: "12%", delay: "0s" },
  { emoji: "✨", top: "15%", left: "78%", delay: "0.8s" },
  { emoji: "💫", top: "35%", left: "5%", delay: "1.6s" },
  { emoji: "⭐", top: "25%", left: "88%", delay: "0.4s" },
  { emoji: "✨", top: "60%", left: "10%", delay: "1.2s" },
  { emoji: "💫", top: "55%", left: "85%", delay: "2s" },
  { emoji: "⭐", top: "75%", left: "20%", delay: "0.6s" },
  { emoji: "✨", top: "70%", left: "75%", delay: "1.4s" },
];

const particles = [
  { emoji: "🌌", top: "5%", left: "50%", delay: "0s", duration: "8s" },
  { emoji: "🪐", top: "20%", left: "90%", delay: "2s", duration: "10s" },
  { emoji: "☄️", top: "80%", left: "15%", delay: "1s", duration: "7s" },
  { emoji: "🌟", top: "90%", left: "80%", delay: "3s", duration: "9s" },
  { emoji: "🛸", top: "45%", left: "3%", delay: "1.5s", duration: "11s" },
  { emoji: "🔭", top: "65%", left: "92%", delay: "2.5s", duration: "8.5s" },
];

export default function Generating() {
  const navigate = useNavigate();
  const { storyInput, setStoryBook, setIsGenerating } = useStore();
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    setIsGenerating(true);

    const stageInterval = setInterval(() => {
      setStage((prev) => (prev + 1) % stageTexts.length);
    }, 2000);

    const startTime = Date.now();
    const totalDuration = 8000;
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / totalDuration) * 100, 95);
      setProgress(pct);
    }, 100);

    const build = async () => {
      try {
        const { title, pages } = generateStory(storyInput);
        const coloringEnabled = storyInput.coloringModeEnabled;

        const bookPages: BookPage[] = [];
        for (let i = 0; i < pages.length; i++) {
          const page: StoryPageTemplate = pages[i];
          let illustrationUrl = await generateIllustration(page.illustrationPrompt);
          if (!illustrationUrl) {
            illustrationUrl = getFallbackIllustration(page.pageType, i);
          }

          let lineArtUrl = "";
          if (coloringEnabled && page.pageType !== "back") {
            setStage(2);
            if (isSvgDataUrl(illustrationUrl)) {
              // SVG fallback插画：直接使用对应的线稿SVG，保证元素100%一致
              lineArtUrl = getFallbackLineArt(page.pageType, i);
            } else {
              // AI生成的位图：使用边缘检测算法提取线稿
              try {
                lineArtUrl = await extractLineArt(illustrationUrl);
              } catch {
                lineArtUrl = getFallbackLineArt(page.pageType, i);
              }
            }
          }

          bookPages.push({
            pageNumber: i + 1,
            illustrationUrl,
            lineArtUrl,
            text: page.text,
            pageType: page.pageType,
            stickers: [],
            coloringArtworks: [],
          });
        }

        const book: StoryBook = {
          id: Date.now().toString(),
          title,
          input: storyInput,
          pages: bookPages,
          createdAt: new Date().toISOString(),
          language: storyInput.language,
        };

        setProgress(100);
        await new Promise((r) => setTimeout(r, 400));

        setStoryBook(book);
        setIsGenerating(false);
        clearInterval(stageInterval);
        clearInterval(progressInterval);
        navigate("/book");
      } catch {
        setIsGenerating(false);
        clearInterval(stageInterval);
        clearInterval(progressInterval);
        navigate("/");
      }
    };

    build();

    return () => {
      clearInterval(stageInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #1a1a3e 0%, #2d2d6e 100%)",
      }}
    >
      <div className="bg-stars absolute inset-0 pointer-events-none" />

      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute text-xl animate-float select-none pointer-events-none opacity-60"
          style={{
            top: p.top,
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        >
          {p.emoji}
        </span>
      ))}

      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute text-2xl animate-twinkle select-none pointer-events-none"
          style={{
            top: s.top,
            left: s.left,
            animationDelay: s.delay,
          }}
        >
          {s.emoji}
        </span>
      ))}

      <div className="relative z-10 flex flex-col items-center">
        <div
          className="w-[120px] h-[120px] rounded-full animate-spin-slow shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #FF6B6B 0%, #C4A8FF 100%)",
            boxShadow:
              "0 0 60px rgba(255, 107, 107, 0.3), 0 0 120px rgba(196, 168, 255, 0.2)",
          }}
        />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
        </div>

        <p className="mt-10 font-display text-xl text-white/90 tracking-wide animate-pulse-soft">
          {stageTexts[stage]}
        </p>

        <div className="mt-6 w-64 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #FFF8E7 0%, #FF6B6B 100%)",
            }}
          />
        </div>

        <p className="mt-3 text-sm text-white/40 font-body">
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}
