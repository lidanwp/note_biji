const fs = require('fs')
const path = require('path')

const publicDir = path.join(__dirname, '..', 'public')
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.png'))

files.forEach(file => {
  const pngPath = path.join(publicDir, file)
  const pngBuffer = fs.readFileSync(pngPath)
  const base64 = pngBuffer.toString('base64')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 64 64">
  <image width="64" height="64" xlink:href="data:image/png;base64,${base64}"/>
</svg>`

  const svgPath = path.join(publicDir, file.replace('.png', '.svg'))
  fs.writeFileSync(svgPath, svg, 'utf-8')
  console.log(`✅ ${file} → ${path.basename(svgPath)}`)
  fs.unlinkSync(pngPath)
})

console.log(`\n🎉 完成: ${files.length} 个文件（PNG 已删除）`)