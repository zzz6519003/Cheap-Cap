import React, { useEffect, useRef, useState } from 'react';
import PhotoEditor from './components/PhotoEditor.web';

type Format = 'JPEG' | 'WEBP';
type Result = { url: string; size: number; width: number; height: number; format: Format };
type ProcessedPhoto = { file: File; result: Result };
type ShareChannel = 'wechat' | 'threads';
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
const qualities = [{ label: '清晰优先', value: 0.8 }, { label: '均衡', value: 0.6 }, { label: '更小体积', value: 0.4 }];
const sizeText = (n: number) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

export default function App() {
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<'compress' | 'edit'>('compress');
  const [format, setFormat] = useState<Format>('JPEG');
  const [quality, setQuality] = useState(0.6);
  const [results, setResults] = useState<ProcessedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => () => { results.forEach(({ result }) => URL.revokeObjectURL(result.url)); }, [results]);
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function choose(selected?: FileList | File[]) {
    if (!selected?.length) return;
    const picked = Array.from(selected);
    const images = picked.filter(file => file.type.startsWith('image/'));
    if (!images.length) { setError('请选择图片文件。'); return; }
    setError(picked.length === images.length ? '' : '已跳过非图片文件。');
    setResults([]);
    setFiles(images);
  }
  async function compress() {
    if (!files.length || busy) return;
    setBusy(true); setError('');
    const completed: ProcessedPhoto[] = [];
    const failures: string[] = [];
    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length });
      const source = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) throw new Error('无法读取这张图片。');
        if (format === 'JPEG') { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
        context.drawImage(image, 0, 0);
        const mime = format === 'JPEG' ? 'image/jpeg' : 'image/webp';
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, quality));
        if (!blob || blob.type !== mime) throw new Error('浏览器不支持此格式，请尝试 JPEG。');
        completed.push({ file, result: { url: URL.createObjectURL(blob), size: blob.size, width: canvas.width, height: canvas.height, format } });
      } catch {
        failures.push(file.name);
      } finally { URL.revokeObjectURL(source); }
    }
    setResults(completed);
    if (failures.length) setError(`成功压缩 ${completed.length} 张，${failures.length} 张失败：${failures.join('、')}。`);
    setBusy(false);
    setProgress(null);
  }
  async function shareResult(photo: ProcessedPhoto, channel: ShareChannel) {
    if (busy) return;
    if (!navigator.share) {
      setError('当前浏览器不支持直接分享，请先下载照片，再从微信朋友圈或 Threads 选择图片。');
      return;
    }
    setBusy(true); setError('');
    try {
      const response = await fetch(photo.result.url);
      const blob = await response.blob();
      const extension = photo.result.format === 'JPEG' ? 'jpg' : 'webp';
      const sharedFile = new File([blob], `${photo.file.name.replace(/\.[^.]+$/, '') || 'photo'}-compressed.${extension}`, { type: blob.type });
      const shareData: ShareData = {
        files: [sharedFile],
        title: channel === 'wechat' ? '分享到微信朋友圈' : '分享到 Threads',
        text: channel === 'wechat' ? '在分享面板中选择微信朋友圈' : '在分享面板中选择 Threads',
      };
      if (navigator.canShare && !navigator.canShare(shareData)) {
        throw new Error('当前浏览器暂不支持分享图片，请先下载照片。');
      }
      await navigator.share(shareData);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : '分享失败，请重试。');
    } finally { setBusy(false); }
  }
  return <><style>{css}</style><div className="shell">
    <header><div className="brand"><span className="mark">◉</span><span>轻拍</span></div><div className="header-actions">{installPrompt && !installed && <button className="install" onClick={install}>安装到桌面</button>}<span className="header-note">LESS SPACE, MORE LIFE</span></div></header>
    <main><section className="intro"><div className="eyebrow"><span /> 轻一点，留住更多</div><h1>每一张照片，<br />都值得<span>轻装保存。</span></h1><p>让照片轻一点，让生活的美好多一点。<br className="desktop" />简单压缩，给回忆留出更多空间。</p><div className="privacy"><span>✳</span> 照片仅在你的设备上处理，支持离线使用</div></section>
    <section className="workspace" aria-label="照片工具"><div className="tab-nav" role="tablist" aria-label="照片工具"><button className={activeTab === 'compress' ? 'active' : ''} role="tab" aria-selected={activeTab === 'compress'} onClick={() => setActiveTab('compress')}>照片压缩</button><button className={activeTab === 'edit' ? 'active' : ''} role="tab" aria-selected={activeTab === 'edit'} onClick={() => setActiveTab('edit')}>照片编辑</button></div>{activeTab === 'compress' ? <><div className="card"><div className="card-head"><div><div className="step">YOUR PHOTO STUDIO</div><h2>开始压缩</h2></div><span className="head-icon">✳</span></div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { choose(e.target.files ?? undefined); e.target.value = ''; }} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { const photo = e.target.files?.[0]; choose(photo ? [photo] : undefined); e.target.value = ''; }} />
      <div className={`drop ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files); }}><div className="upload-icon">↑</div><strong>{files.length ? files.length === 1 ? files[0].name : `已选择 ${files.length} 张照片` : '把照片拖到这里'}</strong><p>{files.length ? files.length === 1 ? `${sizeText(files[0].size)} · 已选择` : '将按顺序逐张压缩' : '拍照或从设备中选择照片'}</p><div className="photo-actions"><button className="select" disabled={busy} onClick={() => cameraInput.current?.click()}>拍照 <span>◎</span></button><button className="select" disabled={busy} onClick={() => input.current?.click()}>{files.length ? '更换照片' : '选择照片'} <span>↗</span></button></div></div>
      <div className="settings-title"><h3>压缩设置</h3><span>按需调整</span></div><div className="setting"><div className="setting-label">照片格式</div><div className="options">{(['JPEG', 'WEBP'] as Format[]).map(f => <button key={f} className={`format ${format === f ? 'active' : ''}`} onClick={() => setFormat(f)} aria-pressed={format === f}><strong>{f}</strong><small>{f === 'JPEG' ? '兼容性更好' : '高效压缩'}</small><span className="check">{format === f ? '✓' : ''}</span></button>)}</div></div>
      <div className="setting"><div className="setting-label">压缩程度</div><div className="qualities">{qualities.map(q => <button key={q.value} className={quality === q.value ? 'active' : ''} onClick={() => setQuality(q.value)} aria-pressed={quality === q.value}>{q.label}</button>)}</div></div>
      <button className="compress" disabled={!files.length || busy} onClick={compress}>{busy ? progress ? `正在压缩 ${progress.current} / ${progress.total}…` : '正在处理…' : '压缩照片'} <span>→</span></button><p className="note">压缩会降低画质，实际大小因照片而异。</p>{error && <p className="error" role="alert">{error}</p>}</div>
      {results.map((photo, index) => {
        const saving = Math.round((1 - photo.result.size / photo.file.size) * 100);
        const extension = photo.result.format === 'JPEG' ? 'jpg' : 'webp';
        return <div className="result" key={`${photo.file.name}-${photo.file.lastModified}-${index}`}><div className="result-head"><div><div className="step">LOOKING GOOD</div><h2>{results.length > 1 ? `照片 ${index + 1} 压缩完成` : '压缩完成'} <span>✳</span></h2></div><span className="tag">{photo.result.format}</span></div><img src={photo.result.url} alt={`压缩后的照片预览：${photo.file.name}`} /><div className="stats"><div><small>原照片</small><strong>{sizeText(photo.file.size)}</strong></div><span className="arrow">→</span><div><small>压缩后</small><strong>{sizeText(photo.result.size)}</strong></div><div className="saving">{saving > 0 ? `减少 ${saving}%` : saving < 0 ? `增大 ${-saving}%` : '大小相近'}</div></div><div className="share-actions"><button className="share-option" disabled={busy} onClick={() => shareResult(photo, 'wechat')}>微信朋友圈 <span>↗</span></button><button className="share-option" disabled={busy} onClick={() => shareResult(photo, 'threads')}>Threads <span>↗</span></button></div><p className="share-note">在系统分享面板中选择对应 App</p><a className="download" href={photo.result.url} download={`${photo.file.name.replace(/\.[^.]+$/, '') || 'photo'}-compressed.${extension}`}>下载照片 <span>↓</span></a><p className="note">{photo.result.width} × {photo.result.height} · 原照片不会被修改</p></div>;
      })}
    </> : <PhotoEditor />}</section></main><footer><span>© 轻拍 · 留住生活的每一刻</span><span>MADE FOR THE LITTLE MOMENTS</span></footer></div></>;
}

const css = `
.editor-controls{border:0;padding:0;margin:0;min-width:0}.editor-controls:disabled{opacity:.65}.editor-stage{user-select:none;cursor:move}.editor-stage>img{pointer-events:none;max-width:none}.crop-frame{position:absolute;border:1.5px solid #fff;box-shadow:0 0 0 1000px #0008;touch-action:none}.crop-grid{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,transparent 33.1%,#ffffff80 33.1%,#ffffff80 33.5%,transparent 33.5%,transparent 66.4%,#ffffff80 66.4%,#ffffff80 66.8%,transparent 66.8%),linear-gradient(to bottom,transparent 33.1%,#ffffff80 33.1%,#ffffff80 33.5%,transparent 33.5%,transparent 66.4%,#ffffff80 66.4%,#ffffff80 66.8%,transparent 66.8%)}.crop-handle{position:absolute;width:32px;height:32px;border:3px solid white;touch-action:none}.crop-handle.nw{left:-1px;top:-1px;border-right:0;border-bottom:0;cursor:nwse-resize}.crop-handle.ne{right:-1px;top:-1px;border-left:0;border-bottom:0;cursor:nesw-resize}.crop-handle.sw{left:-1px;bottom:-1px;border-right:0;border-top:0;cursor:nesw-resize}.crop-handle.se{right:-1px;bottom:-1px;border-left:0;border-top:0;cursor:nwse-resize}.editor-sticker.selected{outline:1px dashed white;outline-offset:4px}.sticker-body{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:0;border:0;background:transparent;font:inherit;line-height:1;color:inherit;cursor:grab;touch-action:none}.sticker-resize{position:absolute;right:-12px;bottom:-12px;width:28px;height:28px;border-radius:50%;background:white;color:#2f6e56;box-shadow:0 1px 5px #0003;display:grid;place-items:center;font:18px sans-serif;touch-action:none;cursor:nwse-resize}.editor-controls .clear-stickers{margin-right:16px}

.editor-tip{margin:10px 0;color:#9aa99e;font-size:11px}.clear-stickers{border:0;background:transparent;padding:12px 0 4px;color:#9d6259;font-size:11px}.editor-stage{touch-action:none}
html,body{height:auto;min-height:100%}body{overflow-y:auto}#root{display:block;height:auto;min-height:100%}.photo-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.share-actions{display:flex;gap:8px;margin-top:20px}.share-option{border:1px solid #c7ddd0;background:#f7fbf7;color:#2f6e56;border-radius:11px;flex:1;padding:12px 10px;font-weight:700;font-size:12px}.share-option:disabled{opacity:.45;cursor:not-allowed}.share-option span{margin-left:8px}.share-note{text-align:center;color:#9aa99e;font-size:11px;margin:9px 0 0}.tab-nav{display:flex;gap:5px;padding:5px;border-radius:14px;background:#e9f0e8;margin-bottom:14px}.tab-nav button{flex:1;border:0;border-radius:10px;padding:12px 8px;background:transparent;color:#718478;font-weight:700;font-size:13px}.tab-nav button.active{background:white;color:#2f6e56;box-shadow:0 2px 8px #244b3612}.editor-layout{min-width:0}.editor-card{padding:24px}.editor-upload{width:100%;min-height:230px;border:1.5px dashed #c9dacd;border-radius:16px;background:#f8faf6;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#3e765b;gap:10px}.editor-upload strong{font-size:14px}.editor-upload small{color:#96a69a;font-size:12px}.editor-stage-wrap{margin:0 auto 14px;max-width:100%;overflow:hidden;border-radius:15px;background:#17231e}.editor-stage{position:relative;width:100%;overflow:hidden;touch-action:none;border-radius:15px;background:#17231e}.editor-stage>img{position:absolute;inset:0;width:100%;height:100%;display:block}.editor-sticker{position:absolute;z-index:1;transform:translate(-50%,-50%);border:0;background:transparent;padding:0;font-size:clamp(30px,8vw,58px);line-height:1;cursor:grab;touch-action:none;user-select:none;}.editor-sticker:active{cursor:grabbing}.editor-actions{display:flex;justify-content:space-between;gap:8px;margin:12px 0 20px}.editor-actions .select{flex:1}.editor-setting{border-top:1px solid #edf1ec;padding:16px 0 2px;margin-top:4px}.editor-setting-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px}.editor-setting-head strong{font-size:13px;color:#405f4e}.editor-setting-head span{font-size:10px;color:#9aa99e;text-align:right}.crop-ratios{display:flex;gap:7px}.crop-ratios button{flex:1;padding:9px 5px;border:1px solid #e3ebe4;border-radius:9px;background:#fff;color:#718478;font-size:11px}.crop-ratios button.active{border-color:#6b9e80;background:#f1f8f2;color:#326a50;font-weight:700}.range-label{display:grid;grid-template-columns:82px 1fr 34px;align-items:center;gap:10px;margin:12px 0;color:#718478;font-size:11px}.range-label input{width:100%;accent-color:#4f8c73}.range-label small{text-align:right;color:#9aa99e;font-size:10px}.sticker-picker{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}.sticker-option{border:1px solid #e6ece6;border-radius:10px;background:#fbfcfa;padding:9px 2px;font-size:22px}.sticker-option:hover{background:#eff6ef;border-color:#a9c9b1}.editor-export{margin-top:18px}.editor-success{margin:12px 0 0;text-align:center;color:#3f805b;font-size:12px}.editor-card .error{margin:12px 0 0;text-align:center}.editor-card .download{margin-top:12px}
*{box-sizing:border-box}html,body,#root{margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}body{background:#f6f7f1;color:#203d33}button,a{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #8fc5a5;outline-offset:3px}.shell{max-width:1320px;margin:auto;padding:0 64px}header{height:100px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e9df}.brand{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:800}.mark{width:37px;height:37px;display:grid;place-items:center;border-radius:12px;background:#295c4e;color:white;font-size:23px}.header-actions{display:flex;align-items:center;gap:16px}.install{border:1px solid #bcd6c4;border-radius:999px;background:#e9f5eb;color:#326a50;padding:9px 14px;font-size:11px;font-weight:700}.header-note,footer{font-size:10px;letter-spacing:1.4px;color:#9aa99d}main{display:grid;grid-template-columns:1fr 520px;gap:80px;align-items:start;max-width:1100px;margin:80px auto 100px}.intro{padding-top:78px}.eyebrow{font-size:12px;letter-spacing:2px;font-weight:700;color:#52866f;display:flex;align-items:center;gap:9px}.eyebrow span{width:25px;height:1px;background:#75a58c}h1{font-size:clamp(36px,4.2vw,58px);line-height:1.4;letter-spacing:-2px;margin:22px 0;color:#1f3b31}h1 span{color:#699a7b}.intro p{font-size:15px;line-height:2;color:#87988c;margin:0}.privacy{display:inline-flex;align-items:center;gap:9px;color:#759182;font-size:12px;margin-top:52px}.privacy span{font-size:20px;color:#77a889}.card,.result{background:#fff;border:1px solid #e8eee6;border-radius:24px;padding:28px;box-shadow:0 18px 60px rgba(53,85,62,.05)}.card-head,.result-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.step{font-size:9px;letter-spacing:1.7px;font-weight:700;color:#9caf9f}h2{font-size:22px;margin:6px 0 0}.head-icon{color:#a7c8b0;font-size:26px}.drop{border:1.5px dashed #c9dacd;border-radius:16px;background:#f8faf6;min-height:206px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;text-align:center}.drop.dragging{background:#eaf5ec;border-color:#4f8c73}.drop strong{font-size:14px;max-width:100%;overflow-wrap:anywhere}.drop p{font-size:12px;color:#a1afa4;margin:8px 0 15px}.upload-icon{display:grid;place-items:center;width:42px;height:42px;background:#e5f0e6;color:#4e8868;border-radius:14px;font-size:22px;margin-bottom:12px}.select{border:1px solid #dce9df;border-radius:9px;background:#fff;color:#3e765b;font-size:12px;font-weight:700;padding:9px 14px}.select span{margin-left:10px}.settings-title{display:flex;align-items:center;justify-content:space-between;margin-top:28px}.settings-title h3{font-size:15px;margin:0}.settings-title span{font-size:11px;color:#a6b3a9}.setting{margin-top:19px}.setting-label{font-size:12px;font-weight:700;color:#718478;margin-bottom:9px}.options,.qualities{display:flex;gap:8px}.format{position:relative;text-align:left;flex:1;border:1px solid #e5ebe5;background:white;border-radius:11px;padding:12px;color:#718078}.format strong,.format small{display:block}.format strong{font-size:13px}.format small{font-size:10px;color:#9ba99e;margin-top:4px}.format.active{border-color:#6b9e80;background:#f3f9f3;color:#326a50}.check{position:absolute;right:12px;top:12px;color:#55936d}.qualities button{flex:1;border:0;border-radius:9px;background:#f5f7f3;color:#829188;padding:11px 4px;font-size:12px}.qualities button.active{background:#dfeee2;color:#2b6a50;font-weight:700}.compress,.download{border:0;width:100%;display:flex;align-items:center;justify-content:center;position:relative;background:#306e56;color:#fff;border-radius:12px;padding:16px;margin-top:24px;font-weight:700;text-decoration:none;font-size:14px}.compress span,.download span{position:absolute;right:18px;font-size:18px}.compress:disabled{opacity:.45;cursor:not-allowed}.note{text-align:center;font-size:11px;color:#a2afa5;line-height:1.6;margin:12px 0 0}.error{color:#a54439;font-size:12px}.result{margin-top:18px}.result h2 span{color:#8db79b}.tag{background:#e7f3e9;color:#438060;font-size:10px;font-weight:700;border-radius:20px;padding:7px 10px}.result img{display:block;width:100%;max-height:330px;object-fit:contain;border-radius:13px;background:#f2f5f0}.stats{display:flex;align-items:center;gap:24px;margin-top:20px}.stats small,.stats strong{display:block}.stats small{font-size:11px;color:#9aa99e}.stats strong{font-size:18px;margin-top:5px}.arrow{color:#b2c2b6}.saving{margin-left:auto;background:#eaf5eb;color:#438060;font-size:11px;font-weight:700;padding:10px;border-radius:9px}.download{margin-top:20px}footer{display:flex;justify-content:space-between;border-top:1px solid #e2e9df;padding:25px 0 32px}footer span:first-child{letter-spacing:0}@media(max-width:850px){.shell{padding:0 24px}header{height:76px}main{grid-template-columns:1fr;gap:32px;margin:45px auto 65px;max-width:560px}.intro{padding:0}h1{font-size:38px}.privacy{margin-top:23px}.desktop{display:none}}@media(max-width:420px){.shell{padding:0 16px}.header-note{font-size:8px}.header-actions{gap:8px}.install{font-size:10px;padding:8px 10px}.card,.result{padding:20px}h1{font-size:33px}.stats{gap:14px}footer span:last-child{display:none}}
`;
