"use client";

import { useMemo, useState } from "react";
import type { Capture, CaptureInputType, CaptureMedia } from "@/domain/models";
import { useWayline } from "@/store/wayline";

type CaptureMode = Exclude<CaptureInputType, "document">;
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type TextDetectorConstructor = new () => { detect: (image: ImageBitmap) => Promise<Array<{ rawValue?: string }>> };

async function browserOcr(file: File): Promise<string> {
  const Detector = (window as unknown as { TextDetector?: TextDetectorConstructor }).TextDetector;
  if (!Detector || !file.type.startsWith("image/")) return "";
  const bitmap = await createImageBitmap(file);
  try {
    const blocks = await new Detector().detect(bitmap);
    return blocks.map((block) => block.rawValue ?? "").filter(Boolean).join("\n");
  } finally {
    bitmap.close();
  }
}

export function CaptureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<CaptureMode>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [listening, setListening] = useState(false);
  const [localError, setLocalError] = useState("");
  const analyzeCapture = useWayline((state) => state.analyzeCapture);
  const confirmCapture = useWayline((state) => state.confirmCapture);
  const cancelCapture = useWayline((state) => state.cancelCapture);
  const captures = useWayline((state) => state.captures);
  const pendingCaptureId = useWayline((state) => state.pendingCaptureId);
  const analyzing = useWayline((state) => state.analyzing);
  const lastError = useWayline((state) => state.lastError);
  const pending = useMemo(() => captures.find((capture) => capture.id === pendingCaptureId), [captures, pendingCaptureId]);

  if (!open) return null;

  const runAnalysis = async () => {
    setLocalError("");
    let normalized = text.trim();
    let media: CaptureMedia | undefined;
    if (file) {
      media = { name: file.name, type: file.type, bytes: await file.arrayBuffer() };
      if (mode === "image" && !normalized) {
        normalized = await browserOcr(file);
        if (normalized) setText(normalized);
      }
    }
    await analyzeCapture({ inputType: mode, text: normalized, media });
  };

  const startVoice = () => {
    const browser = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) {
      setLocalError("当前浏览器不支持语音转写；可直接粘贴转写文字，仍会以 voice 来源进入统一 pipeline。");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => setText(event.results[0]?.[0]?.transcript ?? "");
    recognition.onerror = (event) => setLocalError(`语音转写失败：${event.error}`);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="presentation" onMouseDown={onClose}>
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="统一记录" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold tracking-[.18em] text-sky-700">UNIFIED CAPTURE</p><h2 className="mt-1 text-2xl font-bold text-slate-950">记下任何事情</h2><p className="mt-1 text-sm text-slate-500">所有来源先理解，再由你确认是否进入正式任务序列。</p></div>
          <button className="rounded-full px-3 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose}>关闭</button>
        </div>

        {!pending ? <>
          <div className="mt-5 flex gap-2" role="tablist" aria-label="记录类型">
            {(["text", "voice", "image"] as CaptureMode[]).map((item) => <button key={item} role="tab" aria-selected={mode === item} onClick={() => { setMode(item); setFile(null); setLocalError(""); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === item ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600"}`}>{item === "text" ? "文字" : item === "voice" ? "语音" : "图片"}</button>)}
          </div>
          {mode === "voice" && <div className="mt-4 rounded-2xl bg-sky-50 p-4"><button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm" onClick={startVoice} disabled={listening}>{listening ? "正在聆听…" : "开始语音转写"}</button><p className="mt-2 text-xs text-slate-500">转写结果会作为 voice 输入进入同一理解流程，也可在下方校正。</p></div>}
          {mode === "image" && <div className="mt-4 rounded-2xl bg-sky-50 p-4"><label className="block text-sm font-semibold text-slate-700">上传课程通知、黑板、PPT 或日程截图<input className="mt-2 block w-full text-sm text-slate-600" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><p className="mt-2 text-xs text-slate-500">支持浏览器 TextDetector 时自动 OCR；否则请补充图片中的关键信息。附件字节与元数据会真实进入 provider，而非仅作展示。</p></div>}
          <label className="mt-4 block text-sm font-semibold text-slate-700">{mode === "image" ? "图片文字 / 内容补充" : mode === "voice" ? "语音转写" : "记录内容"}<textarea aria-label="记录内容" className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 p-4 text-sm leading-6 outline-none focus:border-sky-500" value={text} onChange={(event) => setText(event.target.value)} placeholder={mode === "text" ? "例如：我要准备两周后的机器学习考试，范围是 1-8 章。" : mode === "voice" ? "语音转写会出现在这里…" : "例如：机器学习课程两周后考试，考试范围 1-8 章。"} /></label>
          {(localError || lastError) && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{localError || lastError}</p>}
          <div className="mt-5 flex justify-end"><button className="rounded-full bg-sky-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" onClick={runAnalysis} disabled={analyzing || (!text.trim() && !file)}>{analyzing ? "正在理解…" : "理解并预览"}</button></div>
        </> : <CapturePreview capture={pending} onAdjust={() => cancelCapture(pending.id)} onCancel={() => { cancelCapture(pending.id); onClose(); }} onConfirm={() => { confirmCapture(pending.id); setText(""); setFile(null); onClose(); }} />}
      </section>
    </div>
  );
}

function CapturePreview({ capture, onAdjust, onCancel, onConfirm }: { capture: Capture; onAdjust: () => void; onCancel: () => void; onConfirm: () => void }) {
  const result = capture.result;
  return <div className="mt-5" data-testid="capture-preview">
    <div className="rounded-2xl bg-sky-50 p-4 text-sm text-slate-700"><p className="font-bold text-sky-800">识别到{result.actionable ? "可执行任务" : "目标 / Project"}</p><h3 className="mt-2 text-xl font-bold text-slate-950">{result.title}</h3><div className="mt-3 grid gap-2 sm:grid-cols-3"><span>截止：{result.deadline ? new Date(result.deadline).toLocaleString("zh-CN") : "未识别"}</span><span>拆解：{result.suggestedTasks.length} 项</span><span>预计：{result.estimatedDuration ?? 0} 分钟</span></div></div>
    <ol className="mt-4 space-y-2">{result.suggestedTasks.map((task, index) => <li key={`${task.title}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm"><span><b>{index + 1}. {task.title}</b><small className="mt-1 block text-slate-500">{task.estimatedMinutes ?? "—"} 分钟 · 重要性 {task.importance}/10</small></span><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">可执行</span></li>)}</ol>
    {result.warnings.map((warning) => <p key={warning} className="mt-2 text-xs text-slate-400">{warning}</p>)}
    <div className="mt-5 flex flex-wrap justify-end gap-2"><button className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100" onClick={onCancel}>取消</button><button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700" onClick={onAdjust}>调整</button><button className="rounded-full bg-sky-700 px-5 py-2 text-sm font-bold text-white" onClick={onConfirm}>确认加入</button></div>
  </div>;
}
