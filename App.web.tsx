import React, { useEffect, useRef, useState } from 'react';

type Format = 'JPEG' | 'WEBP';
type Result = { url: string; size: number; width: number; height: number; format: Format };
const qualities = [{ label: '清晰优先', value: 0.8 }, { label: '均衡', value: 0.6 }, { label: '更小体积', value: 0.4 }];
const sizeText = (n: number) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

export default function App() {
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>('JPEG');
  const [quality, setQuality] = useState(0.6);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  function choose(next?: File) {
    if (!next) return;
    if (!next.type.startsWith('image/')) { setError('请选择图片文件。'); return; }
    setError(''); setResult(null); setFile(next);
  }
  async function compress() {
    if (!file || busy) return;
    setBusy(true); setError('');
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
      setResult({ url: URL.createObjectURL(blob), size: blob.size, width: canvas.width, height: canvas.height, format });
    } catch (e) { setError(e instanceof Error ? e.message : '处理失败，请尝试另一张图片。'); }
    finally { URL.revokeObjectURL(source); setBusy(false); }
  }
  const saving = file && result ? Math.round((1 - result.size / file.size) * 100) : 0;
  return <><style>{css}</style><div className="shell">
    <header><div className="brand"><span className="mark">◉</span><span>轻拍</span></div><span className="header-note">LESS SPACE, MORE LIFE</span></header>
    <main><section className="intro"><div className="eyebrow"><span /> 轻一点，留住更多</div><h1>每一张照片，<br />都值得<span>轻装保存。</span></h1><p>让照片轻一点，让生活的美好多一点。<br className="desktop" />简单压缩，给回忆留出更多空间。</p><div className="privacy"><span>✳</span> 照片仅在你的设备上处理，不会上传</div></section>
    <section className="workspace" aria-label="照片压缩工具"><div className="card"><div className="card-head"><div><div className="step">YOUR PHOTO STUDIO</div><h2>开始压缩</h2></div><span className="head-icon">✳</span></div>
      <input ref={input} type="file" accept="image/*" hidden onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      <div className={`drop ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}><div className="upload-icon">↑</div><strong>{file ? file.name : '把照片拖到这里'}</strong><p>{file ? `${sizeText(file.size)} · 已选择` : '拍照或从设备中选择一张照片'}</p><div className="photo-actions"><button className="select" disabled={busy} onClick={() => cameraInput.current?.click()}>拍照 <span>◎</span></button><button className="select" disabled={busy} onClick={() => input.current?.click()}>{file ? '更换照片' : '选择照片'} <span>↗</span></button></div></div>
      <div className="settings-title"><h3>压缩设置</h3><span>按需调整</span></div><div className="setting"><div className="setting-label">照片格式</div><div className="options">{(['JPEG', 'WEBP'] as Format[]).map(f => <button key={f} className={`format ${format === f ? 'active' : ''}`} onClick={() => setFormat(f)} aria-pressed={format === f}><strong>{f}</strong><small>{f === 'JPEG' ? '兼容性更好' : '高效压缩'}</small><span className="check">{format === f ? '✓' : ''}</span></button>)}</div></div>
      <div className="setting"><div className="setting-label">压缩程度</div><div className="qualities">{qualities.map(q => <button key={q.value} className={quality === q.value ? 'active' : ''} onClick={() => setQuality(q.value)} aria-pressed={quality === q.value}>{q.label}</button>)}</div></div>
      <button className="compress" disabled={!file || busy} onClick={compress}>{busy ? '正在处理…' : '压缩照片'} <span>→</span></button><p className="note">压缩会降低画质，实际大小因照片而异。</p>{error && <p className="error" role="alert">{error}</p>}</div>
      {result && file && <div className="result"><div className="result-head"><div><div className="step">LOOKING GOOD</div><h2>压缩完成 <span>✳</span></h2></div><span className="tag">{result.format}</span></div><img src={result.url} alt="压缩后的照片预览" /><div className="stats"><div><small>原照片</small><strong>{sizeText(file.size)}</strong></div><span className="arrow">→</span><div><small>压缩后</small><strong>{sizeText(result.size)}</strong></div><div className="saving">{saving > 0 ? `减少 ${saving}%` : saving < 0 ? `增大 ${-saving}%` : '大小相近'}</div></div><a className="download" href={result.url} download={`${file.name.replace(/\.[^.]+$/, '') || 'photo'}-compressed.${result.format === 'JPEG' ? 'jpg' : 'webp'}`}>下载照片 <span>↓</span></a><p className="note">{result.width} × {result.height} · 原照片不会被修改</p></div>}
    </section></main><footer><span>© 轻拍 · 留住生活的每一刻</span><span>MADE FOR THE LITTLE MOMENTS</span></footer></div></>;
}

const css = `
html,body{height:auto;min-height:100%}body{overflow-y:auto}#root{display:block;height:auto;min-height:100%}.photo-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
*{box-sizing:border-box}html,body,#root{margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}body{background:#f6f7f1;color:#203d33}button,a{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #8fc5a5;outline-offset:3px}.shell{max-width:1320px;margin:auto;padding:0 64px}header{height:100px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e9df}.brand{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:800}.mark{width:37px;height:37px;display:grid;place-items:center;border-radius:12px;background:#295c4e;color:white;font-size:23px}.header-note,footer{font-size:10px;letter-spacing:1.4px;color:#9aa99d}main{display:grid;grid-template-columns:1fr 520px;gap:80px;align-items:start;max-width:1100px;margin:80px auto 100px}.intro{padding-top:78px}.eyebrow{font-size:12px;letter-spacing:2px;font-weight:700;color:#52866f;display:flex;align-items:center;gap:9px}.eyebrow span{width:25px;height:1px;background:#75a58c}h1{font-size:clamp(36px,4.2vw,58px);line-height:1.4;letter-spacing:-2px;margin:22px 0;color:#1f3b31}h1 span{color:#699a7b}.intro p{font-size:15px;line-height:2;color:#87988c;margin:0}.privacy{display:inline-flex;align-items:center;gap:9px;color:#759182;font-size:12px;margin-top:52px}.privacy span{font-size:20px;color:#77a889}.card,.result{background:#fff;border:1px solid #e8eee6;border-radius:24px;padding:28px;box-shadow:0 18px 60px rgba(53,85,62,.05)}.card-head,.result-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.step{font-size:9px;letter-spacing:1.7px;font-weight:700;color:#9caf9f}h2{font-size:22px;margin:6px 0 0}.head-icon{color:#a7c8b0;font-size:26px}.drop{border:1.5px dashed #c9dacd;border-radius:16px;background:#f8faf6;min-height:206px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;text-align:center}.drop.dragging{background:#eaf5ec;border-color:#4f8c73}.drop strong{font-size:14px;max-width:100%;overflow-wrap:anywhere}.drop p{font-size:12px;color:#a1afa4;margin:8px 0 15px}.upload-icon{display:grid;place-items:center;width:42px;height:42px;background:#e5f0e6;color:#4e8868;border-radius:14px;font-size:22px;margin-bottom:12px}.select{border:1px solid #dce9df;border-radius:9px;background:#fff;color:#3e765b;font-size:12px;font-weight:700;padding:9px 14px}.select span{margin-left:10px}.settings-title{display:flex;align-items:center;justify-content:space-between;margin-top:28px}.settings-title h3{font-size:15px;margin:0}.settings-title span{font-size:11px;color:#a6b3a9}.setting{margin-top:19px}.setting-label{font-size:12px;font-weight:700;color:#718478;margin-bottom:9px}.options,.qualities{display:flex;gap:8px}.format{position:relative;text-align:left;flex:1;border:1px solid #e5ebe5;background:white;border-radius:11px;padding:12px;color:#718078}.format strong,.format small{display:block}.format strong{font-size:13px}.format small{font-size:10px;color:#9ba99e;margin-top:4px}.format.active{border-color:#6b9e80;background:#f3f9f3;color:#326a50}.check{position:absolute;right:12px;top:12px;color:#55936d}.qualities button{flex:1;border:0;border-radius:9px;background:#f5f7f3;color:#829188;padding:11px 4px;font-size:12px}.qualities button.active{background:#dfeee2;color:#2b6a50;font-weight:700}.compress,.download{border:0;width:100%;display:flex;align-items:center;justify-content:center;position:relative;background:#306e56;color:#fff;border-radius:12px;padding:16px;margin-top:24px;font-weight:700;text-decoration:none;font-size:14px}.compress span,.download span{position:absolute;right:18px;font-size:18px}.compress:disabled{opacity:.45;cursor:not-allowed}.note{text-align:center;font-size:11px;color:#a2afa5;line-height:1.6;margin:12px 0 0}.error{color:#a54439;font-size:12px}.result{margin-top:18px}.result h2 span{color:#8db79b}.tag{background:#e7f3e9;color:#438060;font-size:10px;font-weight:700;border-radius:20px;padding:7px 10px}.result img{display:block;width:100%;max-height:330px;object-fit:contain;border-radius:13px;background:#f2f5f0}.stats{display:flex;align-items:center;gap:24px;margin-top:20px}.stats small,.stats strong{display:block}.stats small{font-size:11px;color:#9aa99e}.stats strong{font-size:18px;margin-top:5px}.arrow{color:#b2c2b6}.saving{margin-left:auto;background:#eaf5eb;color:#438060;font-size:11px;font-weight:700;padding:10px;border-radius:9px}.download{margin-top:20px}footer{display:flex;justify-content:space-between;border-top:1px solid #e2e9df;padding:25px 0 32px}footer span:first-child{letter-spacing:0}@media(max-width:850px){.shell{padding:0 24px}header{height:76px}main{grid-template-columns:1fr;gap:32px;margin:45px auto 65px;max-width:560px}.intro{padding:0}h1{font-size:38px}.privacy{margin-top:23px}.desktop{display:none}}@media(max-width:420px){.shell{padding:0 16px}.header-note{font-size:8px}.card,.result{padding:20px}h1{font-size:33px}.stats{gap:14px}footer span:last-child{display:none}}
`;
