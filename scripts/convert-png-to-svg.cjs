const fs = require('fs')
const path = require('path')
const potrace = require('potrace')

const publicDir = path.join(__dirname, '..', 'public')
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.png'))

const params = {
  color: '#333333',
  background: 'transparent',
  threshold: 128,
  optTolerance: 0.4,
  turdSize: 10,
  turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY
}

let count = 0

files.forEach(file => {
  const inputPath = path.join(publicDir, file)
  const outputPath = path.join(publicDir, file.replace('.png', '.svg'))

  potrace.trace(inputPath, params, (err, svg) => {
    count++
    if (err) {
      console.error(`❌ ${file}: ${err.message}`)
      if (count === files.length) done()
      return
    }
    fs.writeFileSync(outputPath, svg, 'utf-8')
    console.log(`✅ ${file} → ${path.basename(outputPath)}`)
    if (count === files.length) done()
  })
})

function done() {
  console.log(`\n🎉 转换完成: ${files.length} 个文件`)
}