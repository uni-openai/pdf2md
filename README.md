# pdf2md-ts

Forked from [@opendocsg/pdf2md](https://www.npmjs.com/package/@opendocsg/pdf2md)

## Major Changes

[2024-3-2]

1. Add types to the package, typescript needs types!
2. Change to return markdown by pages, return `string[]`.
3. Remove CLI scripts.

## Usage

```bash
npm install --save pdf2md-ts
# or
yarn add pdf2md-ts
```

### Library

**ES5**
```js
const fs = require('fs')
const pdf2md = require('pdf2md-ts')

const pdfBuffer = fs.readFileSync(filePath)
pdf2md(pdfBuffer, callbacks)
  .then(text => {
    console.log(text.join('\n'))
  })
  .catch(err => {
    console.error(err)
  })
```

**ES6 & TS**
```ts
import pdf2md from 'pdf2md-ts'
const buffer =readFileSync(path)
const res = await pdf2md(buffer)
console.log(res) // string[]
```

## Credits

- [@opendocsg/pdf2md](https://www.npmjs.com/package/@opendocsg/pdf2md) - Which is this repo forked from
- [pdf-to-markdown](https://github.com/jzillmann/pdf-to-markdown) - original project by Johannes Zillmann  
- [pdf.js](https://mozilla.github.io/pdf.js/) - Mozilla's PDF parsing & rendering platform which is used as a raw parser
