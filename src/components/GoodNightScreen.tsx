import { Moon, Home } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useNavigate } from "react-router-dom";

const starPositions = [
  { top: "10%", left: "15%", size: "text-2xl", delay: "0s" },
  { top: "15%", right: "20%", size: "text-3xl", delay: "0.5s" },
  { top: "25%", left: "25%", size: "text-xl", delay: "1s" },
  { top: "30%", right: "15%", size: "text-2xl", delay: "1.5s" },
  { top: "40%", left: "10%", size: "text-3xl", delay: "2s" },
  { top: "45%", right: "30%", size: "text-xl", delay: "0.3s" },
  { top: "55%", left: "30%", size: "text-2xl", delay: "0.8s" },
  { top: "60%", right: "10%", size: "text-3xl", delay: "1.3s" },
  { top: "70%", left: "20%", size: "text-xl", delay: "1.8s" },
  { top: "75%", right: "25%", size: "text-2xl", delay: "2.3s" },
  { top: "20%", left: "45%", size: "text-3xl", delay: "0.6s" },
  { top: "65%", left: "50%", size: "text-xl", delay: "1.6s" },
];

export default function GoodNightScreen() {
  const { bedtimeSettings, stopBedtimeMode, resetAll } = useStore();
  const navigate = useNavigate();

  const handleGoHome = () => {
    stopBedtimeMode();
    resetAll();
    navigate("/");
  };

  if (!bedtimeSettings.showGoodNight) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden animate-fade-in"
      style={{ backgroundColor: bedtimeSettings.lightColor }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />

      {starPositions.map((star, i) => (
        <span
          key={i}
          className={`absolute ${star.size} animate-twinkle select-none pointer-events-none`}
          style={{
            top: star.top,
            left: "left" in star ? star.left : undefined,
            right: "right" in star ? star.right : undefined,
            animationDelay: star.delay,
            opacity: 0.8,
          }}
        >
          ⭐
        </span>
      ))}

      <span className="absolute top-[12%] right-[18%] text-4xl animate-float select-none pointer-events-none" style={{ animationDelay: "0.5s" }}>
        🌙
      </span>
      <span className="absolute bottom-[20%] left-[15%] text-3xl animate-float-delayed select-none pointer-events-none" style={{ animationDelay: "1s" }}>
        💫
      </span>
      <span className="absolute top-[35%] left-[8%] text-2xl animate-float select-none pointer-events-none" style={{ animationDelay: "1.5s" }}>
        ✨
      </span>

      <div className="relative z-10 text-center px-8 animate-scale-in">
        <div className="mb-8">
          <div className="w-24 h-24 bg-white/30 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm animate-pulse">
            <Moon className="w-12 h-12 text-white drop-shadow-lg" />
          </div>
        </div>

        <h1 className="font-display text-5xl md:text-6xl text-white mb-6 drop-shadow-lg">
          晚安
        </h1>
        <p className="font-body text-2xl md:text-3xl text-white/90 mb-4 drop-shadow">
          亲爱的小宝贝
        </p>
        <p className="font-body text-lg text-white/70 max-w-md mx-auto leading-relaxed drop-shadow">
          今天的故事就到这里啦
          <br />
          愿你做个甜甜的梦
          <br />
          我们明天再见 💕
        </p>

        <div className="mt-12 flex items-center justify-center gap-3">
          {["❤️", "💕", "💖"].map((heart, i) => (
            <span
              key={i}
              className="text-2xl animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              {heart}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={handleGoHome}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-full font-body hover:bg-white/30 transition-all active:scale-95"
      >
        <Home className="w-5 h-5" />
        <span>回到首页</span>
      </button>
    </div>
  );
}
