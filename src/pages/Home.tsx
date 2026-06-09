import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen, Globe, ChevronRight, Star, Moon } from "lucide-react";
import { useStore } from "@/store/useStore";
import BedtimeSettings from "@/components/BedtimeSettings";

const sampleBooks = [
  {
    title: "小熊的星空冒险",
    image:
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20cute%20bear%20reading%20a%20book%20under%20a%20starry%20sky%2C%20warm%20children%20book%20illustration%20style&image_size=landscape_4_3",
  },
  {
    title: "月球上的小兔子",
    image:
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20cute%20bear%20reading%20a%20book%20under%20a%20starry%20sky%2C%20warm%20children%20book%20illustration%20style&image_size=landscape_4_3",
  },
  {
    title: "彩虹桥的秘密",
    image:
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=A%20cute%20bear%20reading%20a%20book%20under%20a%20starry%20sky%2C%20warm%20children%20book%20illustration%20style&image_size=landscape_4_3",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { resetAll } = useStore();
  const [showBedtimeSettings, setShowBedtimeSettings] = useState(false);

  return (
    <>
      <BedtimeSettings
        isOpen={showBedtimeSettings}
        onClose={() => setShowBedtimeSettings(false)}
      />
    <div className="min-h-screen bg-cream font-body overflow-hidden">
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
        <div className="absolute top-12 left-[10%] text-4xl animate-float select-none">
          ✨
        </div>
        <div className="absolute top-24 right-[12%] text-5xl animate-float-delayed select-none">
          🪐
        </div>
        <div className="absolute bottom-32 left-[15%] text-4xl animate-float select-none">
          📖
        </div>
        <div className="absolute top-[40%] right-[8%] text-2xl animate-twinkle select-none">
          ⭐
        </div>
        <div className="absolute bottom-40 right-[20%] text-2xl animate-twinkle select-none">
          ✨
        </div>

        <div
          className="animate-slide-up text-center"
          style={{ animationDelay: "0ms" }}
        >
          <h1 className="font-display text-6xl md:text-8xl text-gradient mb-6">
            故事星球
          </h1>
        </div>

        <div
          className="animate-slide-up text-center max-w-xl"
          style={{ animationDelay: "200ms" }}
        >
          <p className="text-lg md:text-xl text-warm-brown/80 leading-relaxed mb-10">
            为你的孩子量身定制专属绘本，让TA成为故事里的主角
            <br />
            温暖插画 × 中英双语 × 无限想象
          </p>
        </div>

        <div
          className="animate-slide-up"
          style={{ animationDelay: "400ms" }}
        >
          <button
            onClick={() => {
              resetAll();
              navigate("/create");
            }}
            className="group flex items-center gap-2 bg-coral hover:bg-coral-dark text-white font-display text-xl px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          >
            开始创作
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div
          className="animate-bounce-gentle mt-16 text-warm-brown/40"
          style={{ animationDelay: "800ms" }}
        >
          <Star className="w-6 h-6" />
        </div>
      </section>

      <section className="px-4 py-20 max-w-5xl mx-auto">
        <div
          className="animate-slide-up text-center mb-14"
          style={{ animationDelay: "0ms" }}
        >
          <h2 className="font-display text-3xl md:text-4xl text-warm-brown mb-3">
            为什么选择故事星球？
          </h2>
          <p className="text-warm-brown/60 text-lg">
            每个孩子都值得拥有一个属于自己的故事
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            className="animate-slide-up bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center card-hover"
            style={{ animationDelay: "100ms" }}
          >
            <div className="w-14 h-14 bg-coral/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-7 h-7 text-coral" />
            </div>
            <h3 className="font-display text-xl text-warm-brown mb-3">
              专属故事 ✨
            </h3>
            <p className="text-warm-brown/60 leading-relaxed">
              每个故事都以你的孩子为主角
            </p>
          </div>

          <div
            className="animate-slide-up bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center card-hover"
            style={{ animationDelay: "200ms" }}
          >
            <div className="w-14 h-14 bg-mint/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <BookOpen className="w-7 h-7 text-mint" />
            </div>
            <h3 className="font-display text-xl text-warm-brown mb-3">
              温暖插画 🎨
            </h3>
            <p className="text-warm-brown/60 leading-relaxed">
              可爱的绘本风格，色彩柔和温暖
            </p>
          </div>

          <div
            className="animate-slide-up bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center card-hover"
            style={{ animationDelay: "300ms" }}
          >
            <div className="w-14 h-14 bg-lavender/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Globe className="w-7 h-7 text-lavender" />
            </div>
            <h3 className="font-display text-xl text-warm-brown mb-3">
              中英双语 🌍
            </h3>
            <p className="text-warm-brown/60 leading-relaxed">
              支持中文和英文生成绘本
            </p>
          </div>

          <div
            className="animate-slide-up bg-gradient-to-br from-indigo-50 to-purple-50 backdrop-blur-sm rounded-2xl p-8 text-center card-hover border border-indigo-100 cursor-pointer"
            style={{ animationDelay: "400ms" }}
            onClick={() => setShowBedtimeSettings(true)}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Moon className="w-7 h-7 text-indigo-500" />
            </div>
            <h3 className="font-display text-xl text-warm-brown mb-3">
              睡前模式 🌙
            </h3>
            <p className="text-warm-brown/60 leading-relaxed">
              自定义时间和灯光，营造温馨入睡氛围
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div
          className="animate-slide-up text-center mb-14"
          style={{ animationDelay: "0ms" }}
        >
          <h2 className="font-display text-3xl md:text-4xl text-warm-brown mb-3">
            绘本作品展示
          </h2>
          <p className="text-warm-brown/60 text-lg">
            看看其他小朋友的精彩故事
          </p>
        </div>

        <div
          className="animate-slide-up flex gap-6 overflow-x-auto pb-6 px-4 snap-x snap-mandatory scroll-smooth"
          style={{ animationDelay: "200ms" }}
        >
          {sampleBooks.map((book, index) => (
            <div
              key={index}
              className="snap-center flex-shrink-0 w-64 md:w-72"
              style={{ animationDelay: `${(index + 1) * 150}ms` }}
            >
              <div className="bg-white rounded-2xl overflow-hidden book-shadow card-hover">
                <img
                  src={book.image}
                  alt={book.title}
                  className="w-full aspect-[4/3] object-cover"
                />
                <div className="p-4 text-center">
                  <p className="font-display text-warm-brown">
                    {book.title}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-12 text-center border-t border-soft-pink/30">
        <p className="font-display text-lg text-warm-brown/60">
          ✨ 故事星球 - 让每个孩子成为故事的主角 ✨
        </p>
      </footer>
    </div>
    </>
  );
}
