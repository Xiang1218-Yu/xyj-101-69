import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Sparkles, PenLine, PawPrint, BookOpen, Languages, ChevronUp, ChevronDown, X, Plus, Palette } from "lucide-react";
import { useStore } from "@/store/useStore";

const steps = [
  { icon: "🧒", label: "孩子的名字", lucide: PenLine },
  { icon: "🐾", label: "喜欢的动物", lucide: PawPrint },
  { icon: "📖", label: "最近的故事", lucide: BookOpen },
  { icon: "🌍", label: "选择语言", lucide: Languages },
];

const animals = [
  { name: "猫咪", emoji: "🐱" },
  { name: "小狗", emoji: "🐶" },
  { name: "兔子", emoji: "🐰" },
  { name: "熊猫", emoji: "🐼" },
  { name: "小熊", emoji: "🧸" },
  { name: "小鹿", emoji: "🦌" },
  { name: "小鸟", emoji: "🐦" },
  { name: "海豚", emoji: "🐬" },
];

const experiences = [
  { label: "上学了", emoji: "🎒" },
  { label: "去旅行", emoji: "✈️" },
  { label: "交了新朋友", emoji: "🤝" },
  { label: "搬了新家", emoji: "🏠" },
  { label: "学会了骑车", emoji: "🚲" },
  { label: "过了生日", emoji: "🎂" },
];

const floatingEmojis = ["🦊", "🦋", "🌈", "⭐", "🌺", "🍀"];

export default function Create() {
  const navigate = useNavigate();
  const { storyInput, setStoryInput, currentStep, setCurrentStep } = useStore();
  const [customInput, setCustomInput] = useState("");

  useEffect(() => {
    setCurrentStep(0);
  }, []);

  const isStepValid = () => {
    switch (currentStep) {
      case 0: return storyInput.childName.trim() !== "";
      case 1: return storyInput.favoriteAnimal.trim() !== "";
      case 2: return storyInput.recentExperiences.length > 0;
      case 3: return true;
      default: return false;
    }
  };

  const toggleExperience = (label: string) => {
    const current = storyInput.recentExperiences;
    if (current.includes(label)) {
      setStoryInput({ recentExperiences: current.filter(e => e !== label) });
    } else {
      setStoryInput({ recentExperiences: [...current, label] });
    }
  };

  const addCustomExperience = () => {
    if (customInput.trim() && !storyInput.recentExperiences.includes(customInput.trim())) {
      setStoryInput({ recentExperiences: [...storyInput.recentExperiences, customInput.trim()] });
      setCustomInput("");
    }
  };

  const removeExperience = (label: string) => {
    setStoryInput({ recentExperiences: storyInput.recentExperiences.filter(e => e !== label) });
  };

  const moveExperience = (index: number, direction: "up" | "down") => {
    const arr = [...storyInput.recentExperiences];
    if (direction === "up" && index > 0) {
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    } else if (direction === "down" && index < arr.length - 1) {
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    }
    setStoryInput({ recentExperiences: arr });
  };

  const handleNext = () => {
    if (!isStepValid()) return;
    if (currentStep === 3) {
      navigate("/generating");
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="min-h-screen bg-cream font-body">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    index < currentStep
                      ? "bg-mint text-white"
                      : index === currentStep
                      ? "bg-coral text-white"
                      : "bg-gray-300 text-gray-500"
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span
                  className={`text-xs font-display whitespace-nowrap ${
                    index <= currentStep ? "text-warm-brown" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 md:w-12 h-0.5 mx-1 mb-5 transition-colors duration-300 ${
                    index < currentStep ? "bg-mint" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="relative min-h-[420px]">
          {currentStep === 0 && (
            <div key="step-0" className="animate-slide-up">
              <div className="text-center mb-8">
                <h2 className="font-display text-3xl text-warm-brown mb-2">孩子的名字</h2>
                <p className="text-warm-brown/60">输入宝贝的名字，开启专属冒险之旅</p>
              </div>
              <div className="relative max-w-md mx-auto mb-8">
                {floatingEmojis.map((emoji, i) => (
                  <span
                    key={i}
                    className="absolute text-xl animate-float select-none"
                    style={{
                      top: `${15 + (i % 3) * 30}%`,
                      left: i % 2 === 0 ? `-${8 + i * 2}%` : `${100 + i * 2}%`,
                      animationDelay: `${i * 0.5}s`,
                    }}
                  >
                    {emoji}
                  </span>
                ))}
                <input
                  type="text"
                  value={storyInput.childName}
                  onChange={(e) => setStoryInput({ childName: e.target.value })}
                  placeholder="输入孩子的名字"
                  className="w-full text-center text-2xl font-display py-5 px-6 rounded-2xl border-2 border-coral/30 focus:border-coral focus:outline-none bg-white/80 backdrop-blur-sm placeholder:text-gray-300 transition-all duration-300"
                />
              </div>
              <div className="max-w-sm mx-auto">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 text-center border border-soft-pink/30">
                  <p className="text-warm-brown/60 text-sm mb-2">故事预览</p>
                  <p className="font-display text-lg text-warm-brown">
                    这是属于
                    <span className="text-coral mx-1">
                      {storyInput.childName || "___"}
                    </span>
                    的星球冒险
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div key="step-1" className="animate-slide-up">
              <div className="text-center mb-8">
                <h2 className="font-display text-3xl text-warm-brown mb-2">喜欢的动物</h2>
                <p className="text-warm-brown/60">选择一个小伙伴一起冒险吧</p>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-6">
                {animals.map((animal) => (
                  <button
                    key={animal.name}
                    onClick={() => setStoryInput({ favoriteAnimal: animal.name })}
                    className={`flex flex-col items-center gap-1 py-4 px-2 rounded-2xl bg-white/80 backdrop-blur-sm border-2 transition-all duration-300 ${
                      storyInput.favoriteAnimal === animal.name
                        ? "border-coral scale-105 shadow-lg"
                        : "border-transparent hover:border-coral/30"
                    }`}
                  >
                    <span className="text-3xl">{animal.emoji}</span>
                    <span className="font-display text-sm text-warm-brown">{animal.name}</span>
                  </button>
                ))}
              </div>
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  value={!animals.some((a) => a.name === storyInput.favoriteAnimal) ? storyInput.favoriteAnimal : ""}
                  onChange={(e) => setStoryInput({ favoriteAnimal: e.target.value })}
                  onFocus={() => {
                    if (animals.some((a) => a.name === storyInput.favoriteAnimal)) {
                      setStoryInput({ favoriteAnimal: "" });
                    }
                  }}
                  placeholder="或者输入其他动物..."
                  className="w-full text-center font-display py-3 px-5 rounded-xl border-2 border-coral/30 focus:border-coral focus:outline-none bg-white/80 backdrop-blur-sm placeholder:text-gray-300 transition-all duration-300"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div key="step-2" className="animate-slide-up">
              <div className="text-center mb-6">
                <h2 className="font-display text-3xl text-warm-brown mb-2">最近的故事</h2>
                <p className="text-warm-brown/60">选择最近发生的事，点击↑↓调整时间顺序（先发生的排前面）</p>
              </div>

              <div className="mb-6">
                <p className="text-sm text-warm-brown/70 mb-2">📌 快速选择（可多选）</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {experiences.map((exp) => {
                    const isSelected = storyInput.recentExperiences.includes(exp.label);
                    return (
                      <button
                        key={exp.label}
                        onClick={() => toggleExperience(exp.label)}
                        className={`px-3 py-2 rounded-full font-display text-sm border-2 transition-all duration-300 ${
                          isSelected
                            ? "bg-coral text-white border-coral shadow-md"
                            : "bg-white/80 backdrop-blur-sm text-warm-brown border-transparent hover:border-coral/30"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                        {exp.emoji} {exp.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomExperience();
                    }
                  }}
                  placeholder="添加其他经历..."
                  className="flex-1 font-display py-2.5 px-4 rounded-xl border-2 border-coral/30 focus:border-coral focus:outline-none bg-white/80 backdrop-blur-sm placeholder:text-gray-300 transition-all duration-300"
                />
                <button
                  onClick={addCustomExperience}
                  disabled={!customInput.trim()}
                  className="px-4 py-2 rounded-xl bg-coral text-white font-display text-sm transition-all duration-300 hover:bg-coral-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {storyInput.recentExperiences.length > 0 && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-soft-pink/30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-warm-brown/70 text-sm font-display">✏️ 时间线（先发生的排前面）</p>
                    <p className="text-xs text-warm-brown/50">共 {storyInput.recentExperiences.length} 件</p>
                  </div>
                  <div className="space-y-2">
                    {storyInput.recentExperiences.map((exp, index) => (
                      <div
                        key={exp}
                        className="flex items-center gap-2 p-2 rounded-xl bg-white/60 border border-soft-pink/20 group hover:border-soft-pink/40 transition-all"
                      >
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-lavender/30 text-xs font-display text-warm-brown/70">
                          {index + 1}
                        </span>
                        <span className="flex-1 font-display text-warm-brown text-sm">
                          {exp}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveExperience(index, "up")}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg hover:bg-soft-pink/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-4 h-4 text-warm-brown" />
                          </button>
                          <button
                            onClick={() => moveExperience(index, "down")}
                            disabled={index === storyInput.recentExperiences.length - 1}
                            className="p-1.5 rounded-lg hover:bg-soft-pink/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-4 h-4 text-warm-brown" />
                          </button>
                          <button
                            onClick={() => removeExperience(exp)}
                            className="p-1.5 rounded-lg hover:bg-soft-pink/30 transition-colors ml-1"
                          >
                            <X className="w-4 h-4 text-warm-brown" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div key="step-3" className="animate-slide-up">
              <div className="text-center mb-8">
                <h2 className="font-display text-3xl text-warm-brown mb-2">选择语言</h2>
                <p className="text-warm-brown/60">选择绘本的语言版本</p>
              </div>
              <div className="flex gap-4 justify-center mb-6">
                <button
                  onClick={() => setStoryInput({ language: "zh" })}
                  className={`flex-1 max-w-[200px] py-8 rounded-2xl bg-white/80 backdrop-blur-sm border-2 transition-all duration-300 ${
                    storyInput.language === "zh"
                      ? "border-coral shadow-lg shadow-coral/20 scale-105"
                      : "border-transparent hover:border-coral/30"
                  }`}
                >
                  <span className="text-5xl block mb-3">🇨🇳</span>
                  <span className="font-display text-xl text-warm-brown">中文</span>
                </button>
                <button
                  onClick={() => setStoryInput({ language: "en" })}
                  className={`flex-1 max-w-[200px] py-8 rounded-2xl bg-white/80 backdrop-blur-sm border-2 transition-all duration-300 ${
                    storyInput.language === "en"
                      ? "border-coral shadow-lg shadow-coral/20 scale-105"
                      : "border-transparent hover:border-coral/30"
                  }`}
                >
                  <span className="text-5xl block mb-3">🇬🇧</span>
                  <span className="font-display text-xl text-warm-brown">English</span>
                </button>
              </div>

              <div className="mb-6">
                <label
                  className={`flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 border-2 cursor-pointer transition-all ${
                    storyInput.coloringModeEnabled
                      ? "border-purple-400 shadow-md"
                      : "border-transparent hover:border-purple-200"
                  }`}
                  onClick={() => setStoryInput({ coloringModeEnabled: !storyInput.coloringModeEnabled })}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                      storyInput.coloringModeEnabled ? "bg-purple-500" : "bg-purple-200"
                    }`}>
                      <Palette className={`w-6 h-6 transition-colors ${
                        storyInput.coloringModeEnabled ? "text-white" : "text-purple-600"
                      }`} />
                    </div>
                    <div className="text-left">
                      <p className="font-display text-lg text-warm-brown">🎨 开启绘本绘图模式</p>
                      <p className="text-sm text-warm-brown/60 font-body">生成可涂色的线稿页，让孩子自由上色创作</p>
                    </div>
                  </div>
                  <div
                    className={`w-14 h-8 rounded-full transition-colors relative ${
                      storyInput.coloringModeEnabled ? "bg-purple-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        storyInput.coloringModeEnabled ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </div>
                </label>
              </div>

              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-soft-pink/30">
                <p className="text-warm-brown/60 text-sm text-center mb-3">冒险信息汇总</p>
                <div className="space-y-2 font-display text-warm-brown">
                  <div className="flex justify-between">
                    <span className="text-warm-brown/60">名字</span>
                    <span>{storyInput.childName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warm-brown/60">伙伴</span>
                    <span>{storyInput.favoriteAnimal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warm-brown/60">故事</span>
                    <span className="text-right max-w-[60%]">
                      {storyInput.recentExperiences.join(" → ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warm-brown/60">语言</span>
                    <span>{storyInput.language === "zh" ? "中文" : "English"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warm-brown/60">绘图模式</span>
                    <span className={storyInput.coloringModeEnabled ? "text-purple-600" : "text-warm-brown/40"}>
                      {storyInput.coloringModeEnabled ? "已开启 ✨" : "未开启"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center gap-1 px-6 py-3 rounded-full font-display text-sm transition-all duration-300 ${
              currentStep === 0
                ? "opacity-0 pointer-events-none"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </button>

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className={`flex items-center gap-1 px-6 py-3 rounded-full font-display text-sm transition-all duration-300 ${
                isStepValid()
                  ? "bg-coral hover:bg-coral-dark text-white shadow-md"
                  : "bg-coral/40 text-white/60 cursor-not-allowed"
              }`}
            >
              下一步
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className={`flex items-center gap-1 px-6 py-3 rounded-full font-display text-sm transition-all duration-300 ${
                isStepValid()
                  ? "bg-coral hover:bg-coral-dark text-white shadow-md"
                  : "bg-coral/40 text-white/60 cursor-not-allowed"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              生成我的绘本
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
