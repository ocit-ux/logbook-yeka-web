const { Jimp } = require('jimp');
const path = require('path');

async function main() {
  try {
    const assetsDir = path.join(__dirname, 'assets');
    const logo = await Jimp.read(path.join(assetsDir, 'logo.png'));

    // 1. icon.png: 1024x1024 untuk iOS & ikon launcher standar (latar putih solid)
    const iconBackground = new Jimp({ width: 1024, height: 1024, color: '#ffffff' });
    const logoForIcon = logo.clone();
    logoForIcon.scaleToFit({ w: 720, h: 720 });
    const iconX = (1024 - logoForIcon.bitmap.width) / 2;
    const iconY = (1024 - logoForIcon.bitmap.height) / 2;
    iconBackground.composite(logoForIcon, iconX, iconY);
    await iconBackground.write(path.join(assetsDir, 'icon.png'));

    // 2. adaptive-icon.png: 1024x1024 dengan latar belakang TRANSPARAN untuk Android Adaptive Icon
    // Safe zone Android adalah diameter 66% (~675px), gunakan 580px agar logo aman tidak terpotong bentuk ikon
    const adaptiveBackground = new Jimp({ width: 1024, height: 1024, color: 0x00000000 });
    const logoForAdaptive = logo.clone();
    logoForAdaptive.scaleToFit({ w: 580, h: 580 });
    const adaptX = (1024 - logoForAdaptive.bitmap.width) / 2;
    const adaptY = (1024 - logoForAdaptive.bitmap.height) / 2;
    adaptiveBackground.composite(logoForAdaptive, adaptX, adaptY);
    await adaptiveBackground.write(path.join(assetsDir, 'adaptive-icon.png'));

    // 3. splash.png: 1024x1024 dengan latar belakang TRANSPARAN untuk Splash Screen Android 12+ & Expo
    // Logo proporsional di tengah, warna latar dikendalikan penuh oleh backgroundColor: "#ffffff"
    const splashBackground = new Jimp({ width: 1024, height: 1024, color: 0x00000000 });
    const logoForSplash = logo.clone();
    logoForSplash.scaleToFit({ w: 580, h: 580 });
    const splashX = (1024 - logoForSplash.bitmap.width) / 2;
    const splashY = (1024 - logoForSplash.bitmap.height) / 2;
    splashBackground.composite(logoForSplash, splashX, splashY);
    await splashBackground.write(path.join(assetsDir, 'splash.png'));

    console.log('Success! Generated icon.png, adaptive-icon.png, and splash.png with clean transparent padding for Android 12+.');
  } catch (err) {
    console.error(err);
  }
}

main();
