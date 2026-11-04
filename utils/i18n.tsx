import React, { Children, createContext, isValidElement, cloneElement, useContext, useMemo, useState } from 'react';

export type Language = 'zh' | 'en';

const translations: Record<string, string> = {
  '轻拍': 'SnapLite', '轻一点，留住更多': 'Less space, more life',
  '每一张照片，': 'Every photo', '都值得轻装保存。': 'deserves a lighter footprint.',
  '都值得': 'deserves to be', '轻装保存。': 'saved with less space.',
  '拍下生活的小瞬间，自动压缩照片，让手机空间留给更多回忆。': 'Capture life’s little moments. Compress photos automatically and save more room for memories.',
  '让照片轻一点，让生活的美好多一点。': 'Make photos lighter and leave more room for life.',
  '简单压缩，给回忆留出更多空间。': 'Simple compression gives your memories more space.',
  '照片仅在你的设备上处理，支持离线使用': 'Photos stay on your device. Works offline.',
  '压缩设置': 'Compression settings', '拍摄前选择': 'Choose before shooting', '照片格式': 'Photo format',
  '兼容性更好 · 可存相册': 'Better compatibility · saves to library',
  '高效压缩 · 相册兼容性因设备而异': 'Smaller files · library support varies by device',
  '兼容性更好': 'Better compatibility', '高效压缩': 'Smaller files', '压缩程度': 'Compression',
  '清晰优先': 'Higher quality', '均衡': 'Balanced', '更小体积': 'Smaller file',
  '设置会应用到下一批照片。压缩会降低画质，实际大小因照片而异。': 'Settings apply to your next batch. Compression reduces image quality; results vary by photo.',
  '◎  拍照并压缩': '◎  Take photo', '从相册选择多张照片  ↗': 'Choose photos from library  ↗',
  '正在处理照片…': 'Processing photos…', '正在读取照片…': 'Reading photo…', '预览后保存或分享': 'Preview, then save or share',
  '压缩完成': 'Compression complete', '原照片': 'Original', '压缩后': 'Compressed',
  '大小未知': 'Size unknown', '大小相近': 'Similar size', '再次保存到相册': 'Save to library again',
  '保存到相册': 'Save to library', '分享压缩后的照片': 'Share compressed photo',
  '微信朋友圈': 'WeChat Moments', '在分享面板中选择朋友圈': 'Choose Moments in the share sheet',
  '在分享面板中选择 Threads': 'Choose Threads in the share sheet', '更多分享方式': 'More sharing options',
  '原照片已删除，压缩后的照片已保留在系统相册。': 'Original deleted. The compressed photo remains in your library.',
  'WebP 相册兼容性因设备而异，也可通过分享菜单保存到文件。保存成功后会询问是否删除原照片。': 'WebP library support varies by device. You can also save it to Files from the share sheet. You’ll be asked whether to delete the original after saving.',
  '压缩照片保存成功后，会询问是否删除手机里的原照片。你可以选择保留。': 'After saving, you can choose whether to delete the original photo.',
  '✳  照片只在你的设备上处理': '✳  Photos stay on your device', '安装到桌面': 'Install app',
  '请选择图片文件。': 'Choose image files.', '已跳过非图片文件。': 'Non-image files were skipped.',
  '无法读取这张图片。': 'Could not read this image.', '浏览器不支持此格式，请尝试 JPEG。': 'This format is not supported by your browser. Try JPEG.',
  '当前浏览器不支持直接分享，请先下载照片，再从微信朋友圈或 Threads 选择图片。': 'This browser does not support sharing directly. Download the photo, then choose it in WeChat Moments or Threads.',
  '当前浏览器暂不支持分享图片，请先下载照片。': 'This browser cannot share images yet. Download the photo first.',
  '照片工具': 'Photo tools', '照片压缩': 'Compress', '照片编辑': 'Edit', '开始压缩': 'Start compressing',
  '把照片拖到这里': 'Drop photos here', '将按顺序逐张压缩': 'Photos will be compressed in order',
  '拍照或从设备中选择照片': 'Take a photo or choose from your device', '拍照': 'Take photo',
  '更换照片': 'Replace photo', '选择照片': 'Choose photos', '按需调整': 'Customize', '压缩照片': 'Compress photos',
  '压缩会降低画质，实际大小因照片而异。': 'Compression reduces image quality; results vary by photo.',
  '下载照片': 'Download photo', '原照片不会被修改': 'The original photo is never modified', '压缩后的照片不会被修改': 'The original photo is never modified',
  '分享失败': 'Sharing failed', '分享失败，请重试。': 'Sharing failed. Try again.', '编辑照片': 'Edit photo',
  '选择一张照片开始编辑': 'Choose a photo to start editing', '手势裁剪、调整色彩、缩放贴纸': 'Crop, adjust colors, and resize stickers with gestures',
  '待编辑照片': 'Photo to edit', '完成裁剪': 'Done cropping', '调整裁剪': 'Adjust crop',
  '裁剪比例': 'Aspect ratio', '支持自由裁剪': 'Free crop available', '自由': 'Free', '原比例': 'Original',
  '取景缩放': 'Zoom', '色彩调整': 'Color adjustments', '实时预览': 'Live preview',
  '亮度': 'Brightness', '对比度': 'Contrast', '饱和度': 'Saturation', '贴纸': 'Stickers',
  '选中后可缩放、删除': 'Select to resize or delete', '贴纸大小': 'Sticker size',
  '删除选中贴纸': 'Delete selected sticker', '清除全部贴纸': 'Remove all stickers',
  '正在生成精简照片…': 'Creating optimized photo…', '生成精简照片': 'Export optimized photo',
  '保存到本地': 'Save to device',
  '轻拍 · 留住生活的每一刻': 'SnapLite · Keep life’s little moments',
  '原图': 'Original', '编辑后的内容可能增加体积': 'Edits may increase the file size',
  '仅选择图片文件': 'Choose image files only', '部分照片压缩失败': 'Some photos failed to compress',
  '无法打开照片': 'Could not open photos', '请检查权限后重试。': 'Check permissions and try again.',
  '需要相机权限': 'Camera permission required', '请在手机设置中允许使用相机。': 'Allow camera access in your device settings.',
  '需要相册权限': 'Photo library permission required', '请在手机设置中允许添加照片到相册。': 'Allow adding photos to your library in device settings.',
  '已保存': 'Saved', '压缩后的照片已保存到系统相册。是否删除手机里的原照片？': 'The compressed photo was saved. Delete the original photo from your device?',
  '保留原照片': 'Keep original', '删除原照片': 'Delete original',
  '压缩后的照片已保存到系统相册。当前照片没有可删除的原图记录。': 'The compressed photo was saved. The original cannot be deleted from this record.',
  '保存失败': 'Could not save', '此设备可能不支持将 WebP 保存到相册。你可以分享或保存到文件，也可以使用 JPEG 重新拍摄。': 'This device may not support saving WebP to the library. Share it, save it to Files, or try JPEG.',
  '请重试。': 'Please try again.', '未删除原照片': 'Original not deleted',
  '需要相册修改权限才能删除原照片。': 'Photo library modification permission is required to delete the original.',
  '系统未确认删除这张照片。': 'The system did not confirm that the photo was deleted.',
  '原照片已删除': 'Original deleted', '原照片已从系统相册删除。': 'The original photo was deleted from the system library.',
  '删除失败': 'Could not delete', '系统没有允许删除这张照片，请在相册中手动删除。': 'The system did not allow deletion. Remove the photo from your library manually.',
  '此设备无法打开分享菜单。': 'This device cannot open the share sheet.', '分享到微信朋友圈': 'Share to WeChat Moments',
  '分享到 Threads': 'Share to Threads',
  '拖动选框移动位置，拖动四角裁剪；双指可调整选框大小。': 'Drag the frame to move it and its corners to crop. Pinch to resize the frame.',
  '拖动照片调整取景，双指缩放照片；按住贴纸可移动，双指或右下角可缩放。': 'Drag the photo to reposition it and pinch to zoom. Drag stickers to move them; pinch or use the corner handle to resize.',
  '自动选择体积更小的 JPEG / WebP · 适度有损压缩 · 最长边 2560 像素': 'Automatically picks the smaller JPEG / WebP · balanced lossy compression · 2560 px maximum edge',
  '重置编辑': 'Reset edits', '添加贴纸': 'Add sticker', '选择贴纸': 'Select sticker',
  '浏览器无法绘制贴纸。': 'This browser cannot draw stickers.', '图片尺寸无效。': 'Invalid image dimensions.',
  '无法读取这张照片，请选择浏览器支持的图片。': 'Could not read this photo. Choose an image supported by your browser.',
  '浏览器无法编辑这张照片。': 'This browser cannot edit this photo.', '照片导出失败，请重试。': 'Could not export the photo. Try again.',
  '裁剪': 'Crop',
  '压缩后的照片预览：': 'Compressed photo preview: ', '压缩后的照片预览': 'Compressed photo preview',
  '语言': 'Language', '切换语言': 'Switch language', '已选择': 'Selected',
  '在系统分享面板中选择对应 App': 'Choose the app in the system share sheet', '照片尺寸无效。': 'Invalid photo dimensions.',
};

export function translate(value: string, language: Language): string {
  if (language === 'zh') return value;
  let result = translations[value] ?? value;
  result = result.replace(/正在压缩第 (\d+) \/ (\d+) 张照片…/g, 'Compressing photo $1 of $2…')
    .replace(/正在压缩 (\d+) \/ (\d+)…/g, 'Compressing $1 of $2…')
    .replace(/照片 (\d+) 压缩完成/g, 'Photo $1 compressed')
    .replace(/照片 (\d+)/g, 'Photo $1')
    .replace(/已选择 (\d+) 张照片/g, '$1 photos selected')
    .replace(/第 (\d+) 张/g, 'Photo $1')
    .replace(/成功压缩 (\d+) 张，(\d+) 张失败：/g, 'Compressed $1 photos; $2 failed: ')
    .replace(/成功 (\d+) 张，失败 (\d+) 张：/g, 'Succeeded: $1; failed: $2: ')
    .replace(/减少 (\d+)%/g, '$1% smaller')
    .replace(/增大 (\d+)%/g, '$1% larger')
    .replace(/选择贴纸 (.+)/g, 'Select sticker $1')
    .replace(/添加贴纸 (.+)/g, 'Add sticker $1')
    .replace(/压缩后的照片预览：(.+)/g, 'Compressed photo preview: $1')
    .replace(/原照片 (\d+(?:\.\d+)? (?:KB|MB)) → (\d+(?:\.\d+)? (?:KB|MB))/g, 'Original $1 → $2')
    .replace(/原图\s/g, 'Original ')
    .replace(/保存到本地 · /g, 'Save to device · ')
    .replace(/已选择/g, 'Selected')
    .replace(/原照片不会被修改/g, 'The original photo is never modified')
    .replace(/取景缩放\s/g, 'Zoom ')
    .replace(/贴纸大小\s/g, 'Sticker size ');
  return result;
}

type I18nValue = { language: Language; setLanguage: (language: Language) => void; t: (value: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const value = useMemo(() => ({ language, setLanguage, t: (text: string) => translate(text, language) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider');
  return value;
}

export function Localized({ children }: { children: React.ReactNode }) {
  const { language } = useI18n();
  const visit = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') return translate(node, language);
    if (typeof node === 'number' || node == null || typeof node === 'boolean') return node;
    if (Array.isArray(node)) return node.map(visit);
    if (!isValidElement(node)) return node;
    const props = node.props as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children') next.children = visit(value as React.ReactNode);
      else if (typeof value === 'string' && ['aria-label', 'accessibilityLabel', 'alt', 'title', 'placeholder'].includes(key)) next[key] = translate(value, language);
      else next[key] = value;
    }
    return cloneElement(node, next);
  };
  return <>{Children.map(children, visit)}</>;
}
