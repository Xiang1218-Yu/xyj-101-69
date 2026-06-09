import { useState } from "react";
import { X, Moon, Clock, Palette, Play, ChevronDown } from "lucide-react";
import { useStore } from "@/store/useStore";

interface BedtimeSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const durationOptions = [5, 10, 15, 20, 30, 45, 60];

const colorOptions = [
  { name: "柔和粉", value: "#FFB6C1" },
  { name: "温暖橙", value: "#FFDAB9" },
  { name: "月光蓝", value: "#B0E0E6" },
  { name: "梦幻紫", value: "#E6E6FA" },
  { name: "薄荷绿", value: "#98FB98" },
  { name: "暖黄光", value: "#FFFACD" },
];

export default function BedtimeSettings({ isOpen, onClose }: BedtimeSettingsProps) {
  const { bedtimeSettings, startBedtimeMode } = useStore();
  const [selectedDuration, setSelectedDuration] = useState(bedtimeSettings.duration);
  const [selectedColor, setSelectedColor] = useState(bedtimeSettings.lightColor);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);

  const handleStart = () => {
    startBedtimeMode(selectedDuration, selectedColor);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Moon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display text-2xl">睡前模式</h2>
                <p className="text-white/80 text-sm font-body">营造温馨的入睡氛围</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-warm-brown">
              <Clock className="w-5 h-5" />
              <h3 className="font-display text-lg">阅读时间</h3>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowDurationDropdown(!showDurationDropdown)}
                className="w-full px-4 py-3 rounded-xl border-2 border-warm-brown/10 bg-cream/50 text-warm-brown font-body flex items-center justify-between focus:outline-none focus:border-indigo-400 transition-colors"
              >
                <span>{selectedDuration} 分钟</span>
                <ChevronDown className={`w-5 h-5 transition-transform ${showDurationDropdown ? "rotate-180" : ""}`} />
              </button>
              {showDurationDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-warm-brown/10 overflow-hidden z-10 animate-fade-in">
                  {durationOptions.map((duration) => (
                    <button
                      key={duration}
                      onClick={() => {
                        setSelectedDuration(duration);
                        setShowDurationDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left font-body transition-colors ${
                        selectedDuration === duration
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-warm-brown hover:bg-cream/50"
                      }`}
                    >
                      {duration} 分钟
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-warm-brown/50 font-body">
              时间结束后屏幕将逐渐变暗并显示晚安画面
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-warm-brown">
              <Palette className="w-5 h-5" />
              <h3 className="font-display text-lg">灯光颜色</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    selectedColor === color.value
                      ? "border-indigo-400 scale-105 shadow-lg"
                      : "border-transparent hover:border-warm-brown/20"
                  }`}
                >
                  <div
                    className="w-full aspect-square rounded-lg mb-2 shadow-inner"
                    style={{ backgroundColor: color.value }}
                  />
                  <p className="text-xs font-body text-warm-brown">{color.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: selectedColor }}>
                <Moon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-display text-warm-brown">模式预览</p>
                <p className="text-sm text-warm-brown/60 font-body">
                  {selectedDuration} 分钟 · {colorOptions.find(c => c.value === selectedColor)?.name}
                </p>
              </div>
            </div>
            <div className="h-20 rounded-xl overflow-hidden relative" style={{ backgroundColor: selectedColor, opacity: 0.3 }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-3 left-4 text-white font-display text-lg drop-shadow">
                晚安，小宝贝 🌙
              </div>
              <div className="absolute top-3 right-4 text-2xl animate-twinkle">
                ⭐
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-warm-brown/5 border-t border-warm-brown/10">
          <button
            onClick={handleStart}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-display text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <Play className="w-5 h-5" />
            开始睡前阅读
          </button>
        </div>
      </div>
    </div>
  );
}
