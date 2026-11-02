import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Format = 'JPEG' | 'WEBP';
type Photo = { uri: string; size?: number; width: number; height: number; assetId?: string | null };
type ProcessedPhoto = { original: Photo; result: Photo; format: Format; saved: boolean; originalDeleted: boolean };
type ShareChannel = 'system' | 'wechat' | 'threads';
const qualities = [{ label: '清晰优先', value: 0.8 }, { label: '均衡', value: 0.6 }, { label: '更小体积', value: 0.4 }];
const sizeText = (n?: number) => n == null ? '未知' : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

export default function App() {
  const [format, setFormat] = useState<Format>('JPEG');
  const [quality, setQuality] = useState(0.6);
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  async function compressAsset(asset: ImagePicker.ImagePickerAsset, chosenFormat: Format, chosenQuality: number): Promise<ProcessedPhoto> {
    const input = await FileSystem.getInfoAsync(asset.uri);
    const original = { uri: asset.uri, size: asset.fileSize ?? (input.exists ? input.size : undefined), width: asset.width, height: asset.height, assetId: asset.assetId };
    const output = await ImageManipulator.manipulateAsync(asset.uri, [], { compress: chosenQuality, format: chosenFormat === 'JPEG' ? ImageManipulator.SaveFormat.JPEG : ImageManipulator.SaveFormat.WEBP });
    const info = await FileSystem.getInfoAsync(output.uri);
    return { original, result: { uri: output.uri, size: info.exists ? info.size : undefined, width: output.width, height: output.height }, format: chosenFormat, saved: false, originalDeleted: false };
  }
  async function select(camera: boolean) {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { Alert.alert('需要相机权限', '请在手机设置中允许使用相机。'); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, allowsMultipleSelection: !camera, selectionLimit: 0, orderedSelection: true };
      const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (picked.canceled || !picked.assets.length) return;
      setBusy(true);
      setPhotos([]);
      setProgress({ current: 0, total: picked.assets.length });
      const completed: ProcessedPhoto[] = [];
      const failures: string[] = [];
      for (const [index, asset] of picked.assets.entries()) {
        setProgress({ current: index + 1, total: picked.assets.length });
        try {
          completed.push(await compressAsset(asset, format, quality));
          setPhotos([...completed]);
        } catch {
          failures.push(asset.fileName || `第 ${index + 1} 张`);
        }
      }
      if (failures.length) Alert.alert('部分照片压缩失败', `成功 ${completed.length} 张，失败 ${failures.length} 张：${failures.join('、')}。请尝试 JPEG 格式或重新选择。`);
    } catch (error) { Alert.alert('无法打开照片', error instanceof Error ? error.message : '请检查权限后重试。'); }
    finally { setBusy(false); setProgress(null); }
  }
  async function save(index: number) {
    const photo = photos[index];
    if (!photo) return;
    setBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) { Alert.alert('需要相册权限', '请在手机设置中允许添加照片到相册。'); return; }
      await MediaLibrary.saveToLibraryAsync(photo.result.uri);
      setPhotos(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, saved: true } : item));
      if (photo.original.assetId) {
        Alert.alert('已保存', '压缩后的照片已保存到系统相册。是否删除手机里的原照片？', [
          { text: '保留原照片', style: 'cancel' },
          { text: '删除原照片', style: 'destructive', onPress: () => deleteOriginal(index) },
        ]);
      } else {
        Alert.alert('已保存', '压缩后的照片已保存到系统相册。当前照片没有可删除的原图记录。');
      }
    } catch (error) {
      Alert.alert('保存失败', photo.format === 'WEBP' ? '此设备可能不支持将 WebP 保存到相册。你可以分享或保存到文件，也可以使用 JPEG 重新拍摄。' : (error instanceof Error ? error.message : '请重试。'));
    } finally { setBusy(false); }
  }
  async function deleteOriginal(index: number) {
    const assetId = photos[index]?.original.assetId;
    if (!assetId) return;
    setBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (!permission.granted) {
        Alert.alert('未删除原照片', '需要相册修改权限才能删除原照片。');
        return;
      }
      const deleted = await MediaLibrary.deleteAssetsAsync([assetId]);
      if (!deleted) throw new Error('系统未确认删除这张照片。');
      setPhotos(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, originalDeleted: true } : item));
      Alert.alert('原照片已删除', '原照片已从系统相册删除。');
    } catch (error) {
      Alert.alert('删除失败', error instanceof Error ? error.message : '系统没有允许删除这张照片，请在相册中手动删除。');
    } finally { setBusy(false); }
  }
  async function share(photo: ProcessedPhoto, channel: ShareChannel = 'system') {
    if (!photo) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('此设备无法打开分享菜单。');
      await Sharing.shareAsync(photo.result.uri, {
        mimeType: photo.format === 'WEBP' ? 'image/webp' : 'image/jpeg',
        dialogTitle: channel === 'wechat' ? '分享到微信朋友圈' : channel === 'threads' ? '分享到 Threads' : '分享压缩后的照片',
        UTI: photo.format === 'WEBP' ? 'org.webmproject.webp' : 'public.jpeg',
      });
    } catch (error) { Alert.alert('分享失败', error instanceof Error ? error.message : '请重试。'); }
    finally { setBusy(false); }
  }
  return <SafeAreaProvider><SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoText}>◉</Text></View><Text style={styles.brand}>轻拍</Text><Text style={styles.badge}>LESS SPACE, MORE LIFE</Text></View>
    <Text style={styles.eyebrow}>轻一点，留住更多</Text><Text style={styles.title}>每一张照片，{ '\n' }都值得轻装保存。</Text>
    <Text style={styles.subtitle}>拍下生活的小瞬间，自动压缩照片，让手机空间留给更多回忆。</Text>
    <View style={styles.card}>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>压缩设置</Text><Text style={styles.small}>拍摄前选择</Text></View>
      <Text style={styles.label}>照片格式</Text><View style={styles.row}>{(['JPEG', 'WEBP'] as Format[]).map(f => <Pressable key={f} onPress={() => setFormat(f)} style={[styles.option, format === f && styles.optionActive]}><Text style={[styles.optionTitle, format === f && styles.optionTitleActive]}>{f}</Text><Text style={styles.optionDesc}>{f === 'JPEG' ? '兼容性更好 · 可存相册' : '高效压缩 · 相册兼容性因设备而异'}</Text></Pressable>)}</View>
      <Text style={styles.label}>压缩程度</Text><View style={styles.row}>{qualities.map(q => <Pressable key={q.value} onPress={() => setQuality(q.value)} style={[styles.quality, quality === q.value && styles.qualityActive]}><Text style={[styles.qualityText, quality === q.value && styles.qualityTextActive]}>{q.label}</Text></Pressable>)}</View>
      <Text style={styles.hint}>设置会应用到下一批照片。压缩会降低画质，实际大小因照片而异。</Text>
    </View>
    <Pressable disabled={busy} onPress={() => select(true)} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>◎  拍照并压缩</Text></Pressable>
    <Pressable disabled={busy} onPress={() => select(false)} style={styles.secondary}><Text style={styles.secondaryText}>从相册选择多张照片  ↗</Text></Pressable>
    {busy && <View style={styles.loading}><ActivityIndicator color="#2e6956" /><Text style={styles.hint}>{progress ? `正在压缩第 ${progress.current} / ${progress.total} 张照片…` : '正在处理照片…'}</Text></View>}
    {photos.map((photo, index) => {
      const saving = photo.original.size && photo.result.size ? Math.round((1 - photo.result.size / photo.original.size) * 100) : null;
      return <View key={`${photo.original.assetId ?? photo.original.uri}-${index}`} style={styles.resultCard}><View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>{photos.length > 1 ? `照片 ${index + 1}` : '压缩完成'}</Text><Text style={styles.small}>预览后保存或分享</Text></View><Text style={styles.resultTag}>{photo.format}</Text></View><Image source={{ uri: photo.result.uri }} style={styles.preview} resizeMode="cover" /><View style={styles.stats}><View><Text style={styles.statLabel}>原照片</Text><Text style={styles.stat}>{sizeText(photo.original.size)}</Text></View><Text style={styles.arrow}>→</Text><View><Text style={styles.statLabel}>压缩后</Text><Text style={styles.stat}>{sizeText(photo.result.size)}</Text></View><View style={styles.savedBox}><Text style={styles.savedText}>{saving == null ? '大小未知' : saving > 0 ? `减少 ${saving}%` : saving === 0 ? '大小相近' : `增大 ${-saving}%`}</Text></View></View><Pressable disabled={busy} onPress={() => save(index)} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{photo.saved ? '再次保存到相册' : '保存到相册'}</Text></Pressable><Text style={styles.shareHeading}>分享压缩后的照片</Text><View style={styles.shareOptions}><Pressable disabled={busy} onPress={() => share(photo, 'wechat')} style={[styles.shareOption, busy && styles.disabled]}><Text style={styles.shareOptionTitle}>微信朋友圈</Text><Text style={styles.shareOptionHint}>在分享面板中选择朋友圈</Text></Pressable><Pressable disabled={busy} onPress={() => share(photo, 'threads')} style={[styles.shareOption, busy && styles.disabled]}><Text style={styles.shareOptionTitle}>Threads</Text><Text style={styles.shareOptionHint}>在分享面板中选择 Threads</Text></Pressable></View><Pressable disabled={busy} onPress={() => share(photo)} style={[styles.shareButton, busy && styles.disabled]}><Text style={styles.shareText}>更多分享方式</Text></Pressable><Text style={styles.hint}>{photo.originalDeleted ? '原照片已删除，压缩后的照片已保留在系统相册。' : photo.format === 'WEBP' ? 'WebP 相册兼容性因设备而异，也可通过分享菜单保存到文件。保存成功后会询问是否删除原照片。' : '压缩照片保存成功后，会询问是否删除手机里的原照片。你可以选择保留。'}</Text></View>;
    })}
    <Text style={styles.footer}>✳  照片只在你的设备上处理</Text>
  </ScrollView></SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({safe:{flex:1,backgroundColor:'#f6f7f1'},page:{paddingHorizontal:22,paddingTop:18,paddingBottom:44},header:{flexDirection:'row',alignItems:'center',marginBottom:48},logo:{width:34,height:34,borderRadius:12,backgroundColor:'#295c4e',alignItems:'center',justifyContent:'center'},logoText:{color:'#fff',fontSize:22},brand:{fontSize:20,fontWeight:'800',color:'#1d3830',marginLeft:9},badge:{fontSize:9,letterSpacing:1,color:'#829189',marginLeft:'auto'},eyebrow:{color:'#43816c',fontWeight:'700',fontSize:13,letterSpacing:2,marginBottom:12},title:{fontSize:32,lineHeight:45,fontWeight:'800',color:'#203d33',letterSpacing:0.3},subtitle:{fontSize:14,lineHeight:23,color:'#788880',marginTop:14,marginBottom:26},card:{backgroundColor:'#fff',padding:20,borderRadius:22,borderWidth:1,borderColor:'#e9eee7'},sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sectionTitle:{fontSize:17,fontWeight:'800',color:'#263d34'},small:{fontSize:11,color:'#9ba9a1',marginTop:4},label:{fontSize:12,fontWeight:'700',color:'#6d8175',marginTop:22,marginBottom:10},row:{flexDirection:'row',gap:8},option:{flex:1,borderRadius:13,borderWidth:1,borderColor:'#e4ebe5',padding:12},optionActive:{borderColor:'#4f8c73',backgroundColor:'#f1f8f3'},optionTitle:{fontSize:14,fontWeight:'800',color:'#738078'},optionTitleActive:{color:'#2e6a54'},optionDesc:{fontSize:10,color:'#94a197',marginTop:5},quality:{flex:1,alignItems:'center',paddingVertical:11,borderRadius:10,backgroundColor:'#f5f7f3'},qualityActive:{backgroundColor:'#dcece1'},qualityText:{fontSize:12,color:'#829188'},qualityTextActive:{color:'#2b6a50',fontWeight:'700'},hint:{fontSize:11,lineHeight:18,color:'#96a49a',marginTop:14},primary:{backgroundColor:'#2f6e56',borderRadius:14,alignItems:'center',padding:17,marginTop:16},primaryText:{color:'#fff',fontSize:16,fontWeight:'800'},shareHeading:{fontSize:13,fontWeight:'800',color:'#587365',marginTop:22},shareOptions:{flexDirection:'row',gap:8,marginTop:10},shareOption:{flex:1,borderRadius:13,borderWidth:1,borderColor:'#c7ddd0',backgroundColor:'#f7fbf7',padding:12},shareOptionTitle:{fontSize:14,fontWeight:'800',color:'#2f6e56'},shareOptionHint:{fontSize:10,lineHeight:15,color:'#8ca095',marginTop:5},shareButton:{borderRadius:14,borderWidth:1,borderColor:'#c7ddd0',alignItems:'center',padding:16,marginTop:10},shareText:{color:'#2f6e56',fontSize:15,fontWeight:'800'},secondary:{alignItems:'center',padding:17},secondaryText:{color:'#577367',fontWeight:'700',fontSize:13},disabled:{opacity:0.5},loading:{alignItems:'center',padding:10},resultCard:{backgroundColor:'#fff',borderRadius:22,padding:20,marginTop:12,borderWidth:1,borderColor:'#e9eee7'},resultTag:{fontSize:11,color:'#39735c',backgroundColor:'#e5f2e8',paddingHorizontal:10,paddingVertical:6,borderRadius:20,overflow:'hidden',fontWeight:'700'},preview:{width:'100%',height:240,borderRadius:14,marginTop:16,backgroundColor:'#eef2ed'},stats:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:20},statLabel:{fontSize:11,color:'#98a69d'},stat:{fontSize:18,color:'#254435',fontWeight:'800',marginTop:5},arrow:{fontSize:20,color:'#aebcb2'},savedBox:{backgroundColor:'#e8f4e9',borderRadius:10,padding:10},savedText:{fontSize:12,color:'#377254',fontWeight:'700'},footer:{textAlign:'center',color:'#a3b2a7',fontSize:11,marginTop:28}});
