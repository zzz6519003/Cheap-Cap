import React, { useEffect, useRef, useState } from 'react';
import { centeredCrop, clamp, encodeSmallestPhoto, moveCrop, resizeCrop, zoomCrop, type Corner, type Crop, type Point } from '../utils/photo-editor';

type Ratio = 'free' | 'original' | '1:1' | '4:3' | '16:9';
type Sticker = { id: number; emoji: string; x: number; y: number; size: number };
type Gesture = {
  target: 'photo' | 'sticker' | 'resize';
  corner?: Corner;
  stickerId?: number;
  points: Point[];
  crop: Crop;
  sticker?: Sticker;
  width: number;
  height: number;
};
const fullCrop: Crop = { x: 0, y: 0, width: 1, height: 1 };
const stickerOptions = ['✨', '❤️', '🌸', '🐻', '☀️', '🎀', '🍓', '🦋'];
const ratios = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9 };
const emojiFont = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const emojiCanvases = new Map<string, HTMLCanvasElement>();
function emojiCanvas(emoji: string) {
  const existing = emojiCanvases.get(emoji);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法绘制贴纸。');
  context.font = `480px ${emojiFont}`;
  const metrics = context.measureText(emoji);
  const width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const scale = 480 / Math.max(1, width, height);
  context.translate(256, 256); context.scale(scale, scale);
  context.fillText(emoji, (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2, (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
  emojiCanvases.set(emoji, canvas);
  return canvas;
}

function StickerGlyph({ emoji }: { emoji: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (context) { context.clearRect(0, 0, 512, 512); context.drawImage(emojiCanvas(emoji), 0, 0); }
  }, [emoji]);
  return <canvas ref={ref} width={512} height={512} aria-hidden="true" style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
const midpoint = (points: Point[]) => points.length > 1 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const sizeText = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;

export default function PhotoEditor() {
  const fileInput = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const loadVersion = useRef(0);
  const [photo, setPhoto] = useState<{ file: File; url: string; width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Crop>(fullCrop);
  const [ratio, setRatio] = useState<Ratio>('original');
  const [cropping, setCropping] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<number | null>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [output, setOutput] = useState<{ url: string; name: string; size: number; format: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const current = useRef({ crop, stickers });
  const locked = useRef(false);
  const imageAspect = photo ? photo.width / photo.height : 1;
  const previewAspect = imageAspect * crop.width / crop.height;
  const aspect = cropping ? imageAspect : previewAspect;
  const imageFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output.url); }, [output]);
  useEffect(() => () => { loadVersion.current += 1; }, []);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setStageWidth(stage.getBoundingClientRect().width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [photo]);

  function invalidate() { setOutput(null); setError(''); }
  function changeCrop(next: Crop) {
    current.current.crop = next;
    setCrop(next); invalidate();
  }
  function changeStickers(next: Sticker[]) {
    current.current.stickers = next;
    setStickers(next); invalidate();
  }
  function cancelGesture() { pointers.current.clear(); gesture.current = null; }
  function reset() {
    cancelGesture(); changeCrop(fullCrop); setRatio('original'); setCropping(true);
    setBrightness(100); setContrast(100); setSaturation(100);
    changeStickers([]); setSelectedSticker(null);
  }

  async function loadPhoto(file?: File) {
    if (!file || locked.current) return;
    if (!file.type.startsWith('image/')) { setError('请选择图片文件。'); return; }
    const version = ++loadVersion.current;
    const url = URL.createObjectURL(file);
    setLoading(true); setError('');
    try {
      const image = new Image(); image.src = url;
      await image.decode();
      if (version !== loadVersion.current) { URL.revokeObjectURL(url); return; }
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效。');
      reset(); setPhoto({ file, url, width: image.naturalWidth, height: image.naturalHeight });
    } catch {
      URL.revokeObjectURL(url);
      if (version === loadVersion.current) setError('无法读取这张照片，请选择浏览器支持的图片。');
    } finally { if (version === loadVersion.current) setLoading(false); }
  }

  function rebaseGesture() {
    const active = gesture.current;
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!active || !bounds) return;
    gesture.current = {
      ...active, points: [...pointers.current.values()], crop: { ...current.current.crop },
      sticker: current.current.stickers.find(item => item.id === active.stickerId),
      width: bounds.width, height: bounds.height,
    };
  }
  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (locked.current || loading || (event.pointerType === 'mouse' && event.button !== 0) || pointers.current.size >= 2) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    pointers.current.set(event.pointerId, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!gesture.current) {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-sticker]');
      const corner = (event.target as HTMLElement).closest<HTMLElement>('[data-corner]')?.dataset.corner as Corner | undefined;
      const stickerId = target ? Number(target.dataset.sticker) : undefined;
      setSelectedSticker(stickerId ?? null);
      gesture.current = {
        target: target ? ((event.target as HTMLElement).closest('[data-resize]') ? 'resize' : 'sticker') : 'photo',
        stickerId, corner, points: [], crop: current.current.crop, width: bounds.width, height: bounds.height,
      };
    }
    rebaseGesture();
  }
  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || !pointers.current.has(event.pointerId) || locked.current) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    pointers.current.set(event.pointerId, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    const points = [...pointers.current.values()];
    const start = midpoint(active.points); const end = midpoint(points);
    const dx = (end.x - start.x) / active.width; const dy = (end.y - start.y) / active.height;
    const factor = points.length === 2 ? distance(points[0], points[1]) / Math.max(1, distance(active.points[0], active.points[1])) : 1;
    if (active.sticker) {
      const sticker = active.sticker;
      let size = sticker.size;
      if (points.length === 2) size *= factor;
      else if (active.target === 'resize') {
        const center = { x: sticker.x * active.width, y: sticker.y * active.height };
        size *= distance(end, center) / Math.max(1, distance(start, center));
      }
      const resizing = active.target === 'resize';
      changeStickers(current.current.stickers.map(item => item.id === sticker.id ? {
        ...sticker, x: clamp(sticker.x + (resizing ? 0 : dx), 0, 1), y: clamp(sticker.y + (resizing ? 0 : dy), 0, 1), size: clamp(size, 0.04, 0.6),
      } : item));
    } else if (points.length === 2) {
      const from = cropping ? { x: start.x / active.width, y: start.y / active.height } : {
        x: active.crop.x + start.x / active.width * active.crop.width,
        y: active.crop.y + start.y / active.height * active.crop.height,
      };
      const to = cropping ? { x: end.x / active.width, y: end.y / active.height } : {
        x: from.x - dx * active.crop.width / Math.max(factor, 0.01),
        y: from.y - dy * active.crop.height / Math.max(factor, 0.01),
      };
      changeCrop(zoomCrop(active.crop, cropping ? factor : 1 / Math.max(factor, 0.01), from, to));
    } else if (cropping && active.corner) {
      const fixedAspect = ratio === 'free' ? undefined : ratio === 'original' ? 1 : ratios[ratio] / imageAspect;
      changeCrop(resizeCrop(active.crop, active.corner, dx, dy, fixedAspect));
    } else {
      changeCrop(moveCrop(active.crop, cropping ? dx : -dx * active.crop.width, cropping ? dy : -dy * active.crop.height));
    }
  }
  function pointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size) rebaseGesture(); else gesture.current = null;
  }

  async function exportPhoto() {
    if (!photo || locked.current || loading) return;
    const version = loadVersion.current;
    cancelGesture(); setCropping(false); setSelectedSticker(null);
    locked.current = true; setBusy(true); setError(''); setOutput(null);
    try {
      const image = new Image(); image.src = photo.url; await image.decode();
      const width = photo.width * crop.width; const height = photo.height * crop.height;
      const scale = Math.min(1, 2560 / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('浏览器无法编辑这张照片。');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.filter = imageFilter;
      context.drawImage(image, photo.width * crop.x, photo.height * crop.y, width, height, 0, 0, canvas.width, canvas.height);
      context.filter = 'none';
      stickers.forEach(sticker => {
        const size = sticker.size * canvas.width;
        context.drawImage(emojiCanvas(sticker.emoji), canvas.width * sticker.x - size / 2, canvas.height * sticker.y - size / 2, size, size);
      });
      const blob = await encodeSmallestPhoto(canvas);
      if (version !== loadVersion.current) return;
      const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
      setOutput({ url: URL.createObjectURL(blob), name: `${photo.file.name.replace(/\.[^.]+$/, '') || 'photo'}-edited.${extension}`, size: blob.size, format: extension === 'webp' ? 'WebP' : 'JPEG' });
    } catch (e) { setError(e instanceof Error ? e.message : '照片导出失败，请重试。'); }
    finally { locked.current = false; setBusy(false); }
  }

  const selected = stickers.find(item => item.id === selectedSticker);
  return <div className="editor-layout"><div className="card editor-card">
    <div className="card-head"><div><div className="step">PHOTO EDITOR</div><h2>编辑照片</h2></div><span className="head-icon">✿</span></div>
    <input ref={fileInput} type="file" accept="image/*" hidden disabled={busy || loading} onChange={event => { void loadPhoto(event.target.files?.[0]); event.target.value = ''; }} />
    {!photo ? <button className="editor-upload" disabled={loading} onClick={() => fileInput.current?.click()}><span className="upload-icon">↑</span><strong>{loading ? '正在读取照片…' : '选择一张照片开始编辑'}</strong><small>手势裁剪、调整色彩、缩放贴纸</small></button> : <>
      <fieldset className="editor-controls" disabled={busy || loading}>
        <div className="editor-stage-wrap" style={{ width: `min(100%, ${440 * aspect}px)` }}>
          <div className="editor-stage" ref={stageRef} style={{ aspectRatio: aspect }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}>
            <img src={photo.url} alt="待编辑照片" draggable={false} style={{
              width: `${100 / (cropping ? 1 : crop.width)}%`, height: `${100 / (cropping ? 1 : crop.height)}%`,
              left: `${cropping ? 0 : -crop.x / crop.width * 100}%`, top: `${cropping ? 0 : -crop.y / crop.height * 100}%`, filter: imageFilter,
            }} />
            {cropping ? <div className="crop-frame" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}>
              <div className="crop-grid" />
              {(['nw', 'ne', 'sw', 'se'] as Corner[]).map(corner => <span key={corner} className={`crop-handle ${corner}`} data-corner={corner} />)}
            </div> : stickers.map(sticker => <div key={sticker.id} data-sticker={sticker.id} className={`editor-sticker ${sticker.id === selectedSticker ? 'selected' : ''}`} style={{ left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, width: sticker.size * stageWidth, height: sticker.size * stageWidth, fontSize: sticker.size * stageWidth, fontFamily: emojiFont }}>
              <button type="button" className="sticker-body" aria-label={`选择贴纸 ${sticker.emoji}`} onClick={() => setSelectedSticker(sticker.id)}><StickerGlyph emoji={sticker.emoji} /></button>
              {sticker.id === selectedSticker && <span className="sticker-resize" data-resize="true" aria-hidden="true">↘</span>}
            </div>)}
          </div>
        </div>
        <p className="editor-tip">{cropping ? '拖动选框移动位置，拖动四角裁剪；双指可调整选框大小。' : '拖动照片调整取景，双指缩放照片；按住贴纸可移动，双指或右下角可缩放。'}</p>
        <div className="editor-actions"><button className="select" onClick={() => fileInput.current?.click()}>更换照片</button><button className="select" onClick={reset}>重置编辑</button><button className="select" onClick={() => { cancelGesture(); setCropping(!cropping); setSelectedSticker(null); }}>{cropping ? '完成裁剪' : '调整裁剪'}</button></div>
        <div className="editor-setting"><div className="editor-setting-head"><strong>裁剪比例</strong><span>支持自由裁剪</span></div><div className="crop-ratios">{(['free', 'original', '1:1', '4:3', '16:9'] as Ratio[]).map(value => <button type="button" key={value} className={ratio === value ? 'active' : ''} onClick={() => {
          cancelGesture(); setRatio(value); setCropping(true); setSelectedSticker(null);
          if (value !== 'free') changeCrop(centeredCrop(imageAspect, value === 'original' ? imageAspect : ratios[value]));
        }}>{value === 'free' ? '自由' : value === 'original' ? '原比例' : value}</button>)}</div>
          <label className="range-label">取景缩放 <input aria-label="取景缩放" type="range" min="1" max="8" step="0.01" value={clamp(Math.min(1 / crop.width, 1 / crop.height), 1, 8)} onChange={event => {
            const base = centeredCrop(imageAspect, previewAspect);
            const scale = Math.min(base.width / crop.width, base.height / crop.height) / Number(event.target.value);
            const center = { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
            changeCrop(zoomCrop(crop, scale, center, center));
          }} /><small>{Math.min(1 / crop.width, 1 / crop.height).toFixed(1)}×</small></label>
        </div>
        <div className="editor-setting"><div className="editor-setting-head"><strong>色彩调整</strong><span>实时预览</span></div>
          {([{ name: '亮度', value: brightness, set: setBrightness, min: 50, max: 150 }, { name: '对比度', value: contrast, set: setContrast, min: 50, max: 150 }, { name: '饱和度', value: saturation, set: setSaturation, min: 0, max: 180 }]).map(setting => <label key={setting.name} className="range-label">{setting.name}<input type="range" min={setting.min} max={setting.max} value={setting.value} onChange={event => { setting.set(Number(event.target.value)); invalidate(); }} /><small>{setting.value}%</small></label>)}
        </div>
        <div className="editor-setting"><div className="editor-setting-head"><strong>贴纸</strong><span>选中后可缩放、删除</span></div><div className="sticker-picker">{stickerOptions.map(emoji => <button type="button" key={emoji} className="sticker-option" aria-label={`添加贴纸 ${emoji}`} onClick={() => {
          cancelGesture(); const id = Date.now() + Math.random(); setCropping(false); setSelectedSticker(id);
          changeStickers([...current.current.stickers, { id, emoji, x: 0.5, y: 0.5, size: 0.15 }]);
        }}>{emoji}</button>)}</div>
          {selected && !cropping && <div><label className="range-label">贴纸大小 <input type="range" min="0.04" max="0.6" step="0.01" value={selected.size} onChange={event => changeStickers(stickers.map(item => item.id === selected.id ? { ...item, size: Number(event.target.value) } : item))} /><small>{Math.round(selected.size / 0.15 * 100)}%</small></label><button type="button" className="clear-stickers" onClick={() => { changeStickers(stickers.filter(item => item.id !== selected.id)); setSelectedSticker(null); }}>删除选中贴纸</button></div>}
          {stickers.length > 0 && <button type="button" className="clear-stickers" onClick={() => { changeStickers([]); setSelectedSticker(null); }}>清除全部贴纸</button>}
        </div>
      </fieldset>
      <button className="compress editor-export" disabled={busy || loading} onClick={exportPhoto}>{busy ? '正在生成精简照片…' : '生成精简照片'} <span>↓</span></button>
      <p className="note">自动选择体积更小的 JPEG / WebP · 适度有损压缩 · 最长边 2560 像素</p>
      {output && <><a className="download" href={output.url} download={output.name}>保存到本地 · {output.format} · {sizeText(output.size)} <span>↓</span></a><p className="editor-success" role="status">原图 {sizeText(photo.file.size)} → {sizeText(output.size)}{output.size < photo.file.size ? ` · 减少 ${Math.round((1 - output.size / photo.file.size) * 100)}%` : ' · 编辑后的内容可能增加体积'}</p></>}
    </>}
    {error && <p className="error" role="alert">{error}</p>}
  </div></div>;
}
