import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Format = 'JPEG' | 'WEBP';
type Photo = { uri: string; size?: number; width: number; height: number };
const qualities = [{ label: '清晰优先', value: 0.8 }, { label: '均衡', value: 0.6 }, { label: '更小体积', value: 0.4 }];
const sizeText = (n?: number) => n == null ? '未知' : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

export default function App() {
  const [format, setFormat] = useState<Format>('JPEG');
  const [quality, setQuality] = useState(0.6);
  const [original, setOriginal] = useState<Photo | null>(null);
  const [result, setResult] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resultFormat, setResultFormat] = useState<Format>('JPEG');

  async function compress(asset: ImagePicker.ImagePickerAsset, chosenFormat = format, chosenQuality = quality) {
    setBusy(true); setResult(null); setSaved(false);
    try {
      const input = await FileSystem.getInfoAsync(asset.uri);
      setOriginal({ uri: asset.uri, size: asset.fileSize ?? (input.exists ? input.size : undefined), width: asset.width, height: asset.height });
      const output = await ImageManipulator.manipulateAsync(asset.uri, [], { compress: chosenQuality, format: chosenFormat === 'JPEG' ? ImageManipulator.SaveFormat.JPEG : ImageManipulator.SaveFormat.WEBP });
      const info = await FileSystem.getInfoAsync(output.uri);
      setResult({ uri: output.uri, size: info.exists ? info.size : undefined, width: output.width, height: output.height });
      setResultFormat(chosenFormat);
    } catch (error) {
      Alert.alert('压缩失败', `请尝试 JPEG 格式或选择另一张照片。${error instanceof Error ? `\n${error.message}` : ''}`);
    } finally { setBusy(false); }
  }
  async function select(camera: boolean) {
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { Alert.alert('需要相机权限', '请在手机设置中允许使用相机。'); return; }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
      const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!picked.canceled) await compress(picked.assets[0]);
    } catch (error) { Alert.alert('无法打开照片', error instanceof Error ? error.message : '请检查权限后重试。'); }
  }
  async function save() {
    if (!result) return;
    setBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) { Alert.alert('需要相册权限', '请在手机设置中允许添加照片到相册。'); return; }
      await MediaLibrary.saveToLibraryAsync(result.uri);
      setSaved(true);
      Alert.alert('已保存', '压缩后的照片已保存到系统相册。');
    } catch (error) {
      Alert.alert('保存失败', resultFormat === 'WEBP' ? '此设备可能不支持将 WebP 保存到相册。你可以分享或保存到文件，也可以使用 JPEG 重新拍摄。' : (error instanceof Error ? error.message : '请重试。'));
    } finally { setBusy(false); }
  }
  async function share() {
    if (!result) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('此设备无法打开分享菜单。');
      await Sharing.shareAsync(result.uri, {
        mimeType: resultFormat === 'WEBP' ? 'image/webp' : 'image/jpeg',
        dialogTitle: '分享压缩后的照片',
        UTI: resultFormat === 'WEBP' ? 'org.webmproject.webp' : 'public.jpeg',
      });
    } catch (error) { Alert.alert('分享失败', error instanceof Error ? error.message : '请重试。'); }
    finally { setBusy(false); }
  }
  const saving = original?.size && result?.size ? Math.round((1 - result.size / original.size) * 100) : null;
  return <SafeAreaProvider><SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}><StatusBar barStyle="dark-content" /><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoText}>◉</Text></View><Text style={styles.brand}>轻拍</Text><Text style={styles.badge}>LESS SPACE, MORE LIFE</Text></View>
    <Text style={styles.eyebrow}>轻一点，留住更多</Text><Text style={styles.title}>每一张照片，{ '\n' }都值得轻装保存。</Text>
    <Text style={styles.subtitle}>拍下生活的小瞬间，自动压缩照片，让手机空间留给更多回忆。</Text>
    <View style={styles.card}>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>压缩设置</Text><Text style={styles.small}>拍摄前选择</Text></View>
      <Text style={styles.label}>照片格式</Text><View style={styles.row}>{(['JPEG', 'WEBP'] as Format[]).map(f => <Pressable key={f} onPress={() => setFormat(f)} style={[styles.option, format === f && styles.optionActive]}><Text style={[styles.optionTitle, format === f && styles.optionTitleActive]}>{f}</Text><Text style={styles.optionDesc}>{f === 'JPEG' ? '兼容性更好 · 可存相册' : '高效压缩 · 相册兼容性因设备而异'}</Text></Pressable>)}</View>
      <Text style={styles.label}>压缩程度</Text><View style={styles.row}>{qualities.map(q => <Pressable key={q.value} onPress={() => setQuality(q.value)} style={[styles.quality, quality === q.value && styles.qualityActive]}><Text style={[styles.qualityText, quality === q.value && styles.qualityTextActive]}>{q.label}</Text></Pressable>)}</View>
      <Text style={styles.hint}>设置会应用到下一张照片。压缩会降低画质，实际大小因照片而异。</Text>
    </View>
    <Pressable disabled={busy} onPress={() => select(true)} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>◎  拍照并压缩</Text></Pressable>
    <Pressable disabled={busy} onPress={() => select(false)} style={styles.secondary}><Text style={styles.secondaryText}>从相册选择照片  ↗</Text></Pressable>
    {busy && <View style={styles.loading}><ActivityIndicator color="#2e6956" /><Text style={styles.hint}>正在处理照片…</Text></View>}
    {result && <View style={styles.resultCard}><View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>压缩完成</Text><Text style={styles.small}>预览后保存或分享</Text></View><Text style={styles.resultTag}>{resultFormat}</Text></View><Image source={{ uri: result.uri }} style={styles.preview} resizeMode="cover" /><View style={styles.stats}><View><Text style={styles.statLabel}>原照片</Text><Text style={styles.stat}>{sizeText(original?.size)}</Text></View><Text style={styles.arrow}>→</Text><View><Text style={styles.statLabel}>压缩后</Text><Text style={styles.stat}>{sizeText(result.size)}</Text></View><View style={styles.savedBox}><Text style={styles.savedText}>{saving == null ? '大小未知' : saving > 0 ? `减少 ${saving}%` : saving === 0 ? '大小相近' : `增大 ${-saving}%`}</Text></View></View><Pressable disabled={busy} onPress={save} style={styles.primary}><Text style={styles.primaryText}>{saved ? '再次保存到相册' : '保存到相册'}</Text></Pressable><Pressable disabled={busy} onPress={share} style={styles.shareButton}><Text style={styles.shareText}>分享照片</Text></Pressable><Text style={styles.hint}>{resultFormat === 'WEBP' ? 'WebP 相册兼容性因设备而异，也可通过分享菜单保存到文件。' : '相册中已有的原图不会被删除。拍摄的临时照片不会自动保留。'}</Text></View>}
    <Text style={styles.footer}>✳  照片只在你的设备上处理</Text>
  </ScrollView></SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({safe:{flex:1,backgroundColor:'#f6f7f1'},page:{paddingHorizontal:22,paddingTop:18,paddingBottom:44},header:{flexDirection:'row',alignItems:'center',marginBottom:48},logo:{width:34,height:34,borderRadius:12,backgroundColor:'#295c4e',alignItems:'center',justifyContent:'center'},logoText:{color:'#fff',fontSize:22},brand:{fontSize:20,fontWeight:'800',color:'#1d3830',marginLeft:9},badge:{fontSize:9,letterSpacing:1,color:'#829189',marginLeft:'auto'},eyebrow:{color:'#43816c',fontWeight:'700',fontSize:13,letterSpacing:2,marginBottom:12},title:{fontSize:32,lineHeight:45,fontWeight:'800',color:'#203d33',letterSpacing:0.3},subtitle:{fontSize:14,lineHeight:23,color:'#788880',marginTop:14,marginBottom:26},card:{backgroundColor:'#fff',padding:20,borderRadius:22,borderWidth:1,borderColor:'#e9eee7'},sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sectionTitle:{fontSize:17,fontWeight:'800',color:'#263d34'},small:{fontSize:11,color:'#9ba9a1',marginTop:4},label:{fontSize:12,fontWeight:'700',color:'#6d8175',marginTop:22,marginBottom:10},row:{flexDirection:'row',gap:8},option:{flex:1,borderRadius:13,borderWidth:1,borderColor:'#e4ebe5',padding:12},optionActive:{borderColor:'#4f8c73',backgroundColor:'#f1f8f3'},optionTitle:{fontSize:14,fontWeight:'800',color:'#738078'},optionTitleActive:{color:'#2e6a54'},optionDesc:{fontSize:10,color:'#94a197',marginTop:5},quality:{flex:1,alignItems:'center',paddingVertical:11,borderRadius:10,backgroundColor:'#f5f7f3'},qualityActive:{backgroundColor:'#dcece1'},qualityText:{fontSize:12,color:'#829188'},qualityTextActive:{color:'#2b6a50',fontWeight:'700'},hint:{fontSize:11,lineHeight:18,color:'#96a49a',marginTop:14},primary:{backgroundColor:'#2f6e56',borderRadius:14,alignItems:'center',padding:17,marginTop:16},primaryText:{color:'#fff',fontSize:16,fontWeight:'800'},shareButton:{borderRadius:14,borderWidth:1,borderColor:'#c7ddd0',alignItems:'center',padding:16,marginTop:10},shareText:{color:'#2f6e56',fontSize:15,fontWeight:'800'},secondary:{alignItems:'center',padding:17},secondaryText:{color:'#577367',fontWeight:'700',fontSize:13},disabled:{opacity:0.5},loading:{alignItems:'center',padding:10},resultCard:{backgroundColor:'#fff',borderRadius:22,padding:20,marginTop:12,borderWidth:1,borderColor:'#e9eee7'},resultTag:{fontSize:11,color:'#39735c',backgroundColor:'#e5f2e8',paddingHorizontal:10,paddingVertical:6,borderRadius:20,overflow:'hidden',fontWeight:'700'},preview:{width:'100%',height:240,borderRadius:14,marginTop:16,backgroundColor:'#eef2ed'},stats:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:20},statLabel:{fontSize:11,color:'#98a69d'},stat:{fontSize:18,color:'#254435',fontWeight:'800',marginTop:5},arrow:{fontSize:20,color:'#aebcb2'},savedBox:{backgroundColor:'#e8f4e9',borderRadius:10,padding:10},savedText:{fontSize:12,color:'#377254',fontWeight:'700'},footer:{textAlign:'center',color:'#a3b2a7',fontSize:11,marginTop:28}});
