const { Jimp } = require('jimp');
async function main() {
  try {
    const background = new Jimp({width: 1024, height: 1024, color: '#ffffff'});
    const logo = await Jimp.read('./assets/logo.png');
    logo.scaleToFit({w: 700, h: 700});
    const x = (1024 - logo.bitmap.width) / 2;
    const y = (1024 - logo.bitmap.height) / 2;
    background.composite(logo, x, y);
    await background.write('./assets/icon.png');
    const splash = new Jimp({width: 1242, height: 2436, color: '#ffffff'});
    const splashX = (1242 - logo.bitmap.width) / 2;
    const splashY = (2436 - logo.bitmap.height) / 2;
    splash.composite(logo, splashX, splashY - 100);
    await splash.write('./assets/splash.png');
    console.log('Success! App icon and splash screen generated with WHITE background.');
  } catch (err) {
    console.error(err);
  }
}
main();
