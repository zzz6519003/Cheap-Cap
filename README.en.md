# SnapLite

[简体中文](README.md)

A photo compression app built with Expo and React Native for Android, iOS, and the web. Compress photos on your device, compare original and output sizes, then save the compressed image to your photo library or share it using the system share sheet.

## Languages

The app supports Simplified Chinese and English, with English as the default. Use the language button at the top of the app to switch to Simplified Chinese or back to English. Translation strings are maintained in `utils/i18n.tsx`.

## Run the app

Requires Node.js, npm, and Expo Go on your phone:

```sh
npm install
npx expo start
```

Connect your phone and computer to the same network, then scan the QR code shown in the terminal with Expo Go. On iPhone, you can scan the code with the Camera app. Test camera capture and photo library saving on a real device and grant the requested permissions.

## Usage

1. Choose JPEG or WebP and a compression level, then tap **Take photo** or choose photos from your library. The native and web versions both support selecting multiple photos.
2. Review the output size, then save the result to your library or share it. WebP can also be saved to Files from the share sheet.
3. Settings apply to the next batch of photos. Results are temporarily stored in the app cache and may be removed by the system if they have not been saved.

After a photo is successfully saved to the system library, the native app asks whether to delete the original; you can keep it. A temporary original captured by the camera is not saved automatically. Compression is lossy and does not guarantee a smaller file. Conversion may not preserve original metadata, including location information. Live Photos and animations are processed as still images. WebP library support varies by device; if saving a WebP image to the library fails, use the share sheet to save it to Files. Multiple photos are compressed in order, without background processing.

## Web version

From the project directory, run `npm install`, then `npm run web` and open the address shown in the terminal. For a production build, run `npm run build:web`. This generates the web export, PWA manifest, and offline Service Worker in `dist/`, which can then be deployed with `eas deploy`.

When code is pushed to the GitHub `main` branch, Actions automatically builds the Web/PWA version and publishes it to Expo Hosting production. To enable this for the first time, create an Access Token in [Expo account settings](https://expo.dev/accounts/zzz6519003/settings/access-tokens) and save it as the `EXPO_TOKEN` Actions secret in the GitHub repository. You can also run the `Deploy web` workflow manually from the Actions page.

Choose or drag in multiple images, select a format and compression level, then tap **Compress photos** to preview and download each result. Images are processed in the browser and are not uploaded. Transparent areas are filled with white when converting to JPEG. Browser support for image formats and large images may vary. Conversion may not preserve metadata, and animations are processed as still images. Android Chrome supports installation through **Install app**. On iPhone, use **Add to Home Screen** from Safari's share menu. After opening the installed app once, photo compression is available offline. The browser version cannot delete original photos from the phone's library.

### Photo editor (Web/PWA)

In **Edit**, choose a photo. Drag the crop frame to move the selection and drag its corners to resize it. Free and fixed aspect ratios are available. Tap **Done cropping** to preview, then drag the photo to adjust framing or pinch to zoom. After adding a sticker, drag it to move it; pinch with two fingers or drag the selected sticker's lower-right handle to resize it. You can also use the size slider and delete button.

**Export optimized photo** tries JPEG and WebP at 72% quality and selects the supported format with the smaller actual file size. If WebP is unsupported, it uses JPEG; PNG is not exported. The maximum edge is 2560 pixels, small images are not enlarged, and transparent areas are filled with white. The download button shows the actual format and file size. Any further edit invalidates the previous export, so generate it again. Compression is lossy, and the edited file size depends on the image content.

To run regression checks for the editing logic, use `node --test scripts/test-photo-editor.mjs` (Node.js 22.18 or newer).
